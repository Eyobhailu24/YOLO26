"""Compare warmed-up batch-one prediction latency on preloaded images."""

import argparse
import csv
import json
from datetime import datetime
from pathlib import Path
from time import perf_counter

import cv2
import numpy as np

from common import ROOT, environment, load_model, positive_int, select_device, torch


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=["yolo26n.pt", "yolo26s.pt"])
    parser.add_argument("--source", default=str(ROOT / "samples" / "bus.jpg"),
                        help="An image or directory of images")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--imgsz", type=positive_int, default=640)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--warmup", type=positive_int, default=5)
    parser.add_argument("--iterations", type=positive_int, default=50)
    args = parser.parse_args()
    if not 0 <= args.conf <= 1:
        parser.error("--conf must be between 0 and 1")
    source = Path(args.source)
    if not source.exists():
        parser.error(f"Source does not exist: {source}. Add an image to samples first.")
    paths = sorted(source.iterdir()) if source.is_dir() else [source]
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
    images = []
    for path in paths:
        if path.is_file() and path.suffix.lower() in extensions:
            image = cv2.imread(str(path))
            if image is None:
                parser.error(f"Cannot decode image: {path}")
            images.append(image)
    if not images:
        parser.error("No supported images found in --source")

    device = select_device(args.device)

    def synchronize():
        if str(device).isdecimal():
            torch.cuda.synchronize(int(device))

    rows = []
    for name in args.models:
        model = load_model(name)

        def predict(image):
            return model.predict(
                image, device=device, imgsz=args.imgsz, conf=args.conf,
                rect=False, batch=1, save=False, show=False, verbose=False,
            )

        for index in range(args.warmup):
            predict(images[index % len(images)])
        synchronize()
        latencies = []
        for index in range(args.iterations):
            synchronize()
            start = perf_counter()
            predict(images[index % len(images)])
            synchronize()
            latencies.append((perf_counter() - start) * 1000)
        row = {
            "model": name, "iterations": args.iterations,
            "mean_ms": float(np.mean(latencies)),
            "median_ms": float(np.median(latencies)),
            "p95_ms": float(np.percentile(latencies, 95)),
            "max_ms": max(latencies),
            "prediction_fps": 1000 / float(np.mean(latencies)),
        }
        rows.append(row)
        print(json.dumps(row, indent=2))
        del model
        if str(device).isdecimal():
            torch.cuda.empty_cache()

    output = ROOT / "runs" / f"benchmark_{datetime.now():%Y%m%d_%H%M%S_%f}"
    output.mkdir(parents=True)
    (output / "benchmark.json").write_text(json.dumps({
        "environment": environment(device),
        "source": str(source.resolve()), "image_count": len(images),
        "imgsz": args.imgsz, "conf": args.conf, "warmup": args.warmup,
        "scope": "batch-one prediction including preprocessing and postprocessing; excludes image decoding, display, saving, and model loading",
        "results": rows,
    }, indent=2), encoding="utf-8")
    with (output / "benchmark.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved benchmark: {output}")


if __name__ == "__main__":
    main()
