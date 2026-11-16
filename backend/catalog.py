"""Supported COCO detection checkpoints exposed by the dashboard."""
from typing import Literal

ModelName = Literal[
    "yolo26n.pt", "yolo26s.pt", "yolo26m.pt", "yolo26l.pt", "yolo26x.pt",
    "yolo11l.pt", "rtdetr-l.pt",
]

MODELS = [
    {"id": "yolo26n.pt", "name": "YOLO26 Nano", "family": "YOLO26", "description": "Fastest, lightweight starting point", "size": "2.4M"},
    {"id": "yolo26s.pt", "name": "YOLO26 Small", "family": "YOLO26", "description": "A balance of speed and detail", "size": "9.5M"},
    {"id": "yolo26m.pt", "name": "YOLO26 Medium", "family": "YOLO26", "description": "More capacity for difficult scenes", "size": "20.4M"},
    {"id": "yolo26l.pt", "name": "YOLO26 Large", "family": "YOLO26", "description": "Higher-capacity detection", "size": "24.8M"},
    {"id": "yolo26x.pt", "name": "YOLO26 XLarge", "family": "YOLO26", "description": "Largest YOLO26 detector", "size": "55.7M"},
    {"id": "yolo11l.pt", "name": "YOLO11 Large", "family": "YOLO11", "description": "Previous-generation comparison", "size": "25.3M"},
    {"id": "rtdetr-l.pt", "name": "RT-DETR Large", "family": "RT-DETR", "description": "Transformer-based comparison", "size": "32M"},
]
