"""API contract, image validation, persistence, and upload trust-boundary checks.

Tests use temporary local storage and mock inference / network access.
The real GPU and live Cloudinary smoke checks are documented separately.
"""
import io
import time
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import patch

import cloudinary.utils
import httpx
import numpy as np
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

import backend.app as module
from backend.cloud import Cloud, MAX_BYTES
from backend.store import Store
from backend.catalog import MODELS
from backend.inference import Detector
from common import torch


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(module, "DATA", tmp_path)
    monkeypatch.setattr(module, "MEDIA", tmp_path)
    monkeypatch.setenv("YOLO_DEVICE", "cpu")
    for name in ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]:
        monkeypatch.delenv(name, raising=False)
    with TestClient(module.app) as client:
        yield client


def fake_detection(image, model_name, confidence, size):
    return ([{"class_id": 0, "class_name": "person", "confidence": .9,
              "xyxy": [1, 2, 30, 40]}], np.array(image),
            {"preprocess": 1., "inference": 2., "postprocess": 1.}, 4., False, "cpu")


def test_sample_persistence_download_and_rerun(client):
    with patch.object(module.app.state.detector, "predict", side_effect=fake_detection) as detector:
        response = client.post("/api/predictions", json={"sample": True})
        assert response.status_code == 200
        result = response.json()
        assert result["detections"][0]["class_name"] == "person"
        assert client.get("/api/predictions").json()[0]["id"] == result["id"]
        assert client.get(f"/api/predictions/{result['id']}").json() == result
        image = client.get(f"/api/predictions/{result['id']}/download")
        assert image.status_code == 200
        assert Image.open(io.BytesIO(image.content)).size == (result["width"], result["height"])
        exported = client.get(f"/api/predictions/{result['id']}/download?kind=json")
        assert exported.json() == result
        rerun = client.post("/api/predictions", json={"previous_id": result["id"], "model": "yolo26s.pt", "confidence": .8})
        assert rerun.status_code == 200
        assert rerun.json()["source"] == "history"
        assert detector.call_args.args[1:3] == ("yolo26s.pt", .8)


@pytest.mark.parametrize("payload", [
    {"sample": True, "model": "../../custom.pt"},
    {"sample": True, "confidence": 1.2},
    {"sample": True, "imgsz": 99999},
])
def test_reject_unapproved_settings(client, payload):
    assert client.post("/api/predictions", json=payload).status_code == 422


def test_missing_image_and_cloud_credentials(client):
    assert client.post("/api/predictions", json={}).status_code == 400
    assert client.post("/api/uploads/signature").status_code == 503
    health = client.get("/api/health").json()
    assert health["cloudinary_configured"] is False
    assert "secret" not in str(health).lower()


@pytest.mark.parametrize("model_name", [model["id"] for model in MODELS])
def test_supported_detection_models(client, model_name):
    with patch.object(module.app.state.detector, "predict", side_effect=fake_detection) as detector:
        response = client.post("/api/predictions", json={"sample": True, "model": model_name})
    assert response.status_code == 200
    assert response.json()["model"] == model_name
    assert response.json()["device"] == "cpu"
    assert detector.call_args.args[1] == model_name


def fake_result():
    box = SimpleNamespace(cls=SimpleNamespace(item=lambda: 0), conf=SimpleNamespace(item=lambda: .9), xyxy=np.array([[1, 2, 3, 4]]))
    return SimpleNamespace(boxes=SimpleNamespace(cpu=lambda: [box]), names={0: "person"},
                           speed={"inference": 1.}, plot=lambda: np.zeros((10, 10, 3), dtype=np.uint8))


def test_model_switch_evicts_previous_checkpoint():
    from unittest.mock import MagicMock
    detector = Detector("cpu")
    first = MagicMock()
    first.predict.return_value = [fake_result()]
    second = MagicMock()
    second.predict.return_value = [fake_result()]
    with patch("backend.inference.load_model", side_effect=[first, second]) as load:
        detector.predict(Image.new("RGB", (10, 10)), "yolo26n.pt", .25, 640)
        detector.predict(Image.new("RGB", (10, 10)), "yolo26x.pt", .25, 640)
    assert list(detector.models) == ["yolo26x.pt"]
    assert load.call_count == 2


def test_gpu_memory_failure_retries_and_caches_on_cpu():
    from unittest.mock import MagicMock
    detector = Detector("0")
    gpu = MagicMock()
    gpu.predict.side_effect = torch.cuda.OutOfMemoryError("Simulated GPU exhaustion")
    cpu = MagicMock()
    cpu.predict.return_value = [fake_result()]
    with patch("backend.inference.load_model", side_effect=[gpu, cpu]), patch("backend.inference.torch.cuda.synchronize"), patch("backend.inference.torch.cuda.empty_cache"):
        result = detector.predict(Image.new("RGB", (10, 10)), "yolo26x.pt", .25, 640)
        again = detector.predict(Image.new("RGB", (10, 10)), "yolo26x.pt", .25, 640)
    assert result[-1] == again[-1] == "cpu"
    assert gpu.predict.call_count == 1
    assert cpu.predict.call_count == 2
    assert cpu.predict.call_args.kwargs["device"] == "cpu"


def test_malformed_and_disallowed_images():
    with pytest.raises(HTTPException) as error:
        module.decode_image(b"not an image")
    assert error.value.status_code == 415
    body = io.BytesIO()
    Image.new("RGB", (10, 10)).save(body, format="GIF")
    with pytest.raises(HTTPException) as error:
        module.decode_image(body.getvalue())
    assert error.value.status_code == 415
    with pytest.raises(HTTPException) as error:
        module.decode_image(b"x" * (MAX_BYTES + 1))
    assert error.value.status_code == 413


@pytest.fixture
def cloud(tmp_path, monkeypatch):
    for key, value in {"CLOUDINARY_CLOUD_NAME": "test-cloud", "CLOUDINARY_API_KEY": "test-key", "CLOUDINARY_API_SECRET": "test-secret"}.items():
        monkeypatch.setenv(key, value)
    return Cloud(), Store(tmp_path)


def signed_asset(cloud):
    service, store = cloud
    authorization = service.sign(store)
    public_id = authorization["fields"]["public_id"]
    signature = cloudinary.utils.api_sign_request({"public_id": public_id, "version": 123}, service.secret)
    return SimpleNamespace(upload_id=authorization["upload_id"], public_id=public_id, version=123, signature=signature)


def test_forged_response_rejected_before_network(cloud):
    service, store = cloud
    asset = signed_asset(cloud)
    asset.signature = "0" * 40
    with patch("backend.cloud.httpx.stream") as network, pytest.raises(HTTPException) as error:
        service.download(asset, store)
    assert error.value.status_code == 400
    network.assert_not_called()


def test_expired_ticket_rejected(cloud):
    service, store = cloud
    asset = signed_asset(cloud)
    with store.connect() as db:
        db.execute("UPDATE uploads SET created = ?", (int(time.time()) - 3601,))
    with patch("backend.cloud.httpx.stream") as network, pytest.raises(HTTPException):
        service.download(asset, store)
    network.assert_not_called()


def test_verified_asset_uses_fixed_cloudinary_host(cloud):
    service, store = cloud
    asset = signed_asset(cloud)
    response = httpx.Response(200, content=b"example image bytes")
    with patch("backend.cloud.httpx.stream", return_value=nullcontext(response)) as network:
        body, url = service.download(asset, store)
    assert body == b"example image bytes"
    assert url == f"https://res.cloudinary.com/test-cloud/image/upload/v123/{asset.public_id}"
    assert network.call_args.kwargs["follow_redirects"] is False


def test_oversized_cloud_asset_is_rejected(cloud):
    service, store = cloud
    asset = signed_asset(cloud)
    response = httpx.Response(200, content=b"x" * (MAX_BYTES + 1))
    with patch("backend.cloud.httpx.stream", return_value=nullcontext(response)), pytest.raises(HTTPException) as error:
        service.download(asset, store)
    assert error.value.status_code == 413
