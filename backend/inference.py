"""Cached YOLO models with serialized access on the selected device."""
import threading
import gc
from time import perf_counter

import numpy as np
from fastapi import HTTPException

from common import load_model, torch


class Detector:
    def __init__(self, device):
        self.device = device
        self.models = {}
        self.model_device = None
        self.lock = threading.Lock()

    def predict(self, image, model_name, confidence, size):
        if not self.lock.acquire(timeout=30):
            raise HTTPException(429, "The detector is busy. Try again in a moment.")
        try:
            cold = model_name not in self.models
            if cold:
                # Bound GPU memory when switching among larger checkpoints.
                self.models.clear()
                gc.collect()
                if str(self.device).isdecimal():
                    torch.cuda.empty_cache()
                self.models[model_name] = load_model(model_name)
                self.model_device = self.device
            model = self.models[model_name]
            device = self.model_device
            if str(device).isdecimal():
                torch.cuda.synchronize(int(device))
            start = perf_counter()
            try:
                result = model.predict(image, device=device, conf=confidence,
                                       imgsz=size, rect=False, verbose=False)[0]
            except torch.cuda.OutOfMemoryError:
                if not str(device).isdecimal():
                    raise
                # Recreate the predictor on CPU; don't retain its failed CUDA tensors.
                self.models.clear()
                del model
                gc.collect()
                torch.cuda.empty_cache()
                model = load_model(model_name)
                self.models[model_name] = model
                device = self.model_device = "cpu"
                result = model.predict(image, device=device, conf=confidence,
                                       imgsz=size, rect=False, verbose=False)[0]
            if str(device).isdecimal():
                torch.cuda.synchronize(int(device))
            prediction_ms = (perf_counter() - start) * 1000
            detections = [{
                "class_id": int(box.cls.item()),
                "class_name": result.names[int(box.cls.item())],
                "confidence": float(box.conf.item()),
                "xyxy": [round(float(value), 2) for value in box.xyxy[0].tolist()],
            } for box in result.boxes.cpu()]
            # result.plot returns BGR; image serializers expect RGB.
            annotated = np.ascontiguousarray(result.plot()[..., ::-1])
            return detections, annotated, result.speed, prediction_ms, cold, str(device)
        finally:
            self.lock.release()
