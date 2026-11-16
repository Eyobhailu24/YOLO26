"""Detect objects in images, directories, video files, or a webcam."""

import argparse
import json
from pathlib import Path

from common import ROOT, load_model, positive_int, select_device


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sample = ROOT / "samples" / "bus.jpg"
    parser.add_argument("--source", default=str(sample) if sample.exists()
                        else "https://ultralytics.com/images/bus.jpg")
    parser.add_argument("--model", default="yolo26n.pt")
    parser.add_argument("--device", default="auto", help="auto, cpu, or GPU index such as 0")
    parser.add_argument("--imgsz", type=positive_int, default=640)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--show", action="store_true")
    parser.add_argument("--max-frames", type=positive_int, help="Stop after this many results")
    args = parser.parse_args()
    if not 0 <= args.conf <= 1:
        parser.error("--conf must be between 0 and 1")

    device = select_device(args.device)
    source = int(args.source) if args.source.isdecimal() else args.source
    model = load_model(args.model)
    print(f"Running {args.model} on {device}")
    results = model.predict(
        source=source, device=device, imgsz=args.imgsz, conf=args.conf,
        save=True, show=args.show, stream=True,
        project=str(ROOT / "runs"), name="predict", verbose=False,
    )
    count = 0
    report_path = None
    report = None
    try:
        for index, result in enumerate(results, start=1):
            if report is None:
                report_path = Path(result.save_dir) / "detections.jsonl"
                report = report_path.open("w", encoding="utf-8")
            detections = []
            for box in result.boxes.cpu():
                class_id = int(box.cls.item())
                detections.append({
                    "class_id": class_id,
                    "class_name": result.names[class_id],
                    "confidence": round(box.conf.item(), 5),
                    "xyxy": box.xyxy[0].tolist(),
                })
            report.write(json.dumps({
                "index": index, "source": str(result.path),
                "detections": detections, "speed_ms": result.speed,
            }) + "\n")
            count = index
            print(f"Result {index}: {len(detections)} detections; {result.path}")
            if args.max_frames and count >= args.max_frames:
                break
    finally:
        results.close()
        # Release video writers even when stopping a generator early.
        for writer in getattr(model.predictor, "vid_writer", {}).values():
            writer.release()
        for capture in getattr(getattr(model.predictor, "dataset", None), "caps", []):
            if capture is not None:
                capture.release()
        if args.show:
            import cv2
            cv2.destroyAllWindows()
        if report is not None:
            report.close()
    print(f"Processed {count} results. Detection report: {report_path}")


if __name__ == "__main__":
    main()
