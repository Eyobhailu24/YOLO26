"""Shared paths, device selection, and report metadata."""

import os
import platform
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ.setdefault("YOLO_CONFIG_DIR", str(ROOT / ".ultralytics"))

import torch
import ultralytics
from ultralytics import RTDETR, YOLO


def select_device(value="auto"):
    if value == "auto":
        return "0" if torch.cuda.is_available() else "cpu"
    if value.isdecimal() and not torch.cuda.is_available():
        raise ValueError("CUDA is unavailable. Use --device cpu or install CUDA-enabled PyTorch.")
    return value


def load_model(name):
    path = Path(name)
    # Keep official downloaded weights in this project, while accepting custom paths.
    if path.parent == Path(".") and name.startswith(("yolo", "rtdetr")) and not path.exists():
        path = ROOT / "models" / name
        path.parent.mkdir(parents=True, exist_ok=True)
    loader = RTDETR if path.stem.startswith("rtdetr") else YOLO
    return loader(str(path))


def environment(device):
    return {
        "python": platform.python_version(),
        "ultralytics": ultralytics.__version__,
        "torch": torch.__version__,
        "device": str(device),
        "hardware": torch.cuda.get_device_name(int(device))
        if str(device).isdecimal() else platform.processor(),
    }


def positive_int(value):
    import argparse

    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number
