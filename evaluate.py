"""Evaluate one or more detection models on a labeled dataset."""

import argparse
import json
from pathlib import Path

from common import ROOT, environment, load_model, positive_int, select_device
from ultralytics import settings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=["yolo26n.pt"])
    parser.add_argument("--data", default="coco8.yaml")
    parser.add_argument("--split", choices=["val", "test"], default="val")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--imgsz", type=positive_int, default=640)
    parser.add_argument("--batch", type=positive_int, default=1)
    args = parser.parse_args()
    device = select_device(args.device)
    settings.update({"datasets_dir": str(ROOT / "datasets")})
    for name in args.models:
        metrics = load_model(name).val(
            data=args.data, split=args.split, device=device,
            imgsz=args.imgsz, batch=args.batch, workers=0,
            plots=True, project=str(ROOT / "runs"), name=f"eval_{Path(name).stem}",
        )
        report = {
            "model": name, "data": args.data, "split": args.split,
            "imgsz": args.imgsz, "batch": args.batch,
            "environment": environment(device),
            "precision": float(metrics.box.mp), "recall": float(metrics.box.mr),
            "map50": float(metrics.box.map50), "map50_95": float(metrics.box.map),
            "speed_ms": metrics.speed,
        }
        path = Path(metrics.save_dir) / "metrics.json"
        path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        print(f"Saved metrics: {path}")


if __name__ == "__main__":
    main()
