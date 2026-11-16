"""Cached YOLO models with serialized access on the selected device."""
import threading
from time import perf_counter

import numpy as np
from fastapi import HTTPException

from common import load_model, torch


class Detector:
    def __init__(self, device):
        self.device = device
        self.models = {}
        self.lock = threading.Lock()

    def predict(self, image, model_name, confidence, size):
        if not self.lock.acquire(timeout=30):
            raise HTTPException(429, "The detector is busy. Try again in a moment.")
        try:
            cold = model_name not in self.models
            if cold:
                self.models[model_name] = load_model(model_name)
            model = self.models[model_name]
            if str(self.device).isdecimal():
                torch.cuda.synchronize(int(self.device))
            start = perf_counter()
            result = model.predict(image, device=self.device, conf=confidence,
                                   imgsz=size, rect=False, verbose=False)[0]
            if str(self.device).isdecimal():
                torch.cuda.synchronize(int(self.device))
            prediction_ms = (perf_counter() - start) * 1000
            detections = [{
                "class_id": int(box.cls.item()),
                "class_name": result.names[int(box.cls.item())],
                "confidence": float(box.conf.item()),
                "xyxy": [round(float(value), 2) for value in box.xyxy[0].tolist()],
            } for box in result.boxes.cpu()]
            # result.plot returns BGR; image serializers expect RGB.
            annotated = np.ascontiguousarray(result.plot()[..., ::-1])
            return detections, annotated, result.speed, prediction_ms, cold
        finally:
            self.lock.release()
