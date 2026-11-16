"""FastAPI application for a single-user local detection dashboard."""
import io
import logging
import os
import uuid
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field

from common import ROOT, environment, select_device
from backend.cloud import Cloud, MAX_BYTES
from backend.inference import Detector
from backend.store import Store

load_dotenv(ROOT / ".env")
DATA = ROOT / "runs" / "dashboard"
MEDIA = DATA / "media"
FRONTEND = ROOT / "frontend" / "dist"
MEDIA.mkdir(parents=True, exist_ok=True)
log = logging.getLogger(__name__)


class Asset(BaseModel):
    upload_id: str = Field(pattern=r"^[a-f0-9]{32}$")
    public_id: str = Field(pattern=r"^yolo26/uploads/[a-f0-9]{32}$")
    version: int = Field(gt=0)
    signature: str = Field(pattern=r"^[a-f0-9]{40}$")


class Prediction(BaseModel):
    model: Literal["yolo26n.pt", "yolo26s.pt"] = "yolo26n.pt"
    confidence: float = Field(default=0.25, ge=0.01, le=0.95)
    imgsz: Literal[320, 640, 960] = 640
    sample: bool = False
    asset: Asset | None = None
    previous_id: uuid.UUID | None = None
    filename: str = Field(default="uploaded-image", max_length=200)


def decode_image(body):
    if len(body) > MAX_BYTES:
        raise HTTPException(413, "Images must be 10 MB or smaller.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(body)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise HTTPException(415, "Use a JPEG, PNG, or WebP image.")
                if image.width * image.height > 25_000_000:
                    raise HTTPException(413, "The image exceeds the 25 megapixel limit.")
                image.load()
                return ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise HTTPException(415, "This file is not a supported, readable image.") from error


@asynccontextmanager
async def lifespan(app):
    app.state.store = Store(DATA)
    app.state.cloud = Cloud()
    app.state.device = select_device(os.getenv("YOLO_DEVICE", "auto"))
    app.state.detector = Detector(app.state.device)
    yield


app = FastAPI(title="YOLO26 Studio", lifespan=lifespan)


@app.get("/api/health")
def health():
    return {"status": "ok", "cloudinary_configured": app.state.cloud.configured,
            "environment": environment(app.state.device),
            "models": ["yolo26n.pt", "yolo26s.pt"], "max_upload_bytes": MAX_BYTES}


@app.post("/api/uploads/signature")
def signature():
    return app.state.cloud.sign(app.state.store)


@app.get("/api/predictions")
def history():
    return app.state.store.recent()


@app.get("/api/predictions/{prediction_id}")
def detail(prediction_id: uuid.UUID):
    result = app.state.store.get(str(prediction_id))
    if not result:
        raise HTTPException(404, "This test was not found.")
    return result


@app.get("/api/predictions/{prediction_id}/download")
def download(prediction_id: uuid.UUID, kind: Literal["image", "json"] = "image"):
    result = detail(prediction_id)
    filename = f"{prediction_id}.jpg" if kind == "image" else f"{prediction_id}.json"
    return FileResponse(MEDIA / filename, filename=f"yolo26-{result['id']}.{ 'jpg' if kind == 'image' else 'json'}")


@app.get("/api/sample")
def sample():
    return FileResponse(ROOT / "samples" / "bus.jpg")


@app.post("/api/predictions")
def predict(request: Prediction):
    start = perf_counter()
    if sum([request.sample, request.asset is not None, request.previous_id is not None]) != 1:
        raise HTTPException(400, "Choose one sample, uploaded image, or previous test.")
    if request.sample:
        body = (ROOT / "samples" / "bus.jpg").read_bytes()
        cloud_url = None
        filename = "bus.jpg"
    elif request.asset:
        body, cloud_url = app.state.cloud.download(request.asset, app.state.store)
        filename = Path(request.filename.replace("\\", "/")).name
    elif request.previous_id:
        previous = detail(request.previous_id)
        original = MEDIA / f"{request.previous_id}-original.jpg"
        if not original.is_file():
            raise HTTPException(404, "The previous test image is no longer available.")
        body = original.read_bytes()
        cloud_url = previous["cloudinary_url"]
        filename = previous["filename"]
    else:
        raise HTTPException(400, "Upload an image or select the sample first.")
    image = decode_image(body)
    prediction_id = str(uuid.uuid4())
    try:
        detections, annotated, speeds, prediction_ms, cold = app.state.detector.predict(
            image, request.model, request.confidence, request.imgsz,
        )
        image.save(MEDIA / f"{prediction_id}-original.jpg", quality=94)
        Image.fromarray(annotated).save(MEDIA / f"{prediction_id}.jpg", quality=94)
        result = {
            "id": prediction_id, "created_at": datetime.now(timezone.utc).isoformat(),
            "filename": filename, "model": request.model, "confidence": request.confidence,
            "imgsz": request.imgsz, "width": image.width, "height": image.height,
            "device": str(app.state.device), "source": "sample" if request.sample else "history" if request.previous_id else "cloudinary",
            "cloudinary_url": cloud_url,
            "original_url": f"/api/media/{prediction_id}-original.jpg",
            "annotated_url": f"/api/media/{prediction_id}.jpg",
            "detections": detections, "speed_ms": speeds,
            "prediction_ms": round(prediction_ms, 2),
            "total_ms": round((perf_counter() - start) * 1000, 2), "cold_start": cold,
        }
        import json
        (MEDIA / f"{prediction_id}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        app.state.store.save(result)
        return result
    except HTTPException:
        raise
    except Exception as error:
        log.exception("Prediction failed")
        raise HTTPException(500, "Detection failed. Try Nano at 320 px, or check the server log.") from error


app.mount("/api/media", StaticFiles(directory=MEDIA), name="media")

if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
