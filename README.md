# YOLO26 local testing

Run pretrained object detection on images, videos, and a webcam; evaluate labeled
data; compare nano and small model speed. All commands below run from this folder
in PowerShell. No environment activation is required.

## Environment

The local environment uses Python 3.12. Scripts select an available CUDA GPU by
default and otherwise use the CPU. Override with `--device cpu` or `--device 0`.
The initial machine has an NVIDIA GTX 1650 with 4 GB VRAM, so evaluation defaults
to batch size 1 and zero data-loader workers for Windows compatibility.

To recreate the environment:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
# NVIDIA GPU setup (omit this line for a CPU-only installation):
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

`requirements-lock.txt` records the exact installed versions after verification.
For those versions, install with `-r requirements-lock.txt` and
`--extra-index-url https://download.pytorch.org/whl/cu126` on a compatible NVIDIA
machine. Use the normal requirements file for a fresh CPU installation.

## 1. Predict

```powershell
# Public sample image; automatically downloads weights on the first run:
.\.venv\Scripts\python.exe predict.py

# One image, a folder, or a recorded video:
.\.venv\Scripts\python.exe predict.py --source samples/bus.jpg
.\.venv\Scripts\python.exe predict.py --source samples/
.\.venv\Scripts\python.exe predict.py --source samples/test.mp4

# Webcam: press Q to quit the preview, or use --max-frames for a bounded run:
.\.venv\Scripts\python.exe predict.py --source 0 --show
.\.venv\Scripts\python.exe predict.py --source 0 --show --max-frames 100

# Compare a larger detector or adjust the confidence threshold:
.\.venv\Scripts\python.exe predict.py --source samples/bus.jpg --model yolo26s.pt --conf 0.4
```

Each execution creates a new `runs/predict*` folder with annotated media and
`detections.jsonl`. Each JSON line contains a one-based result index, source,
class IDs, class names, confidence, pixel bounding boxes `[x1, y1, x2, y2]`,
and the library's preprocessing/inference/postprocessing timings.

Use `--show` only when you want a local preview window. Webcam usage is available
but isn't opened during setup. A live source runs until you quit or reach the
frame limit. CLI details are available with `--help` on each script.

## 2. Review representative inputs

Add your own images and clips to `samples/`. Begin with 30-50 images covering
good light, low light, small objects, motion blur, partial occlusion, and scenes
without target objects. Review false positives, missed objects, incorrect
classes, and bounding-box quality.

Pretrained detection models recognize 80 COCO classes, which you can inspect:

```powershell
.\.venv\Scripts\python.exe -c "from common import load_model; print(load_model('yolo26n.pt').names)"
```

Objects outside these classes require a suitable checkpoint or custom training.
Unlabeled images allow visual review but do not establish accuracy.

## 3. Evaluate labeled data

```powershell
# Tiny downloaded dataset: verifies the evaluation pipeline, not general accuracy.
.\.venv\Scripts\python.exe evaluate.py

# Evaluate both models under the same settings:
.\.venv\Scripts\python.exe evaluate.py --models yolo26n.pt yolo26s.pt

# Your dataset, using a held-out test split defined in its YAML:
.\.venv\Scripts\python.exe evaluate.py --data datasets/my_data.yaml --split test
```

The first evaluation downloads COCO8 under `datasets/`. Each model gets a new
`runs/eval_*` directory containing `metrics.json`, plots, and other Ultralytics
outputs. Reports include precision, recall, mAP50, mAP50-95, settings, versions,
and hardware. Scores are fractions from 0 to 1; higher is better.

Custom detection datasets need image/label pairs and a dataset YAML. Each YOLO
label row is `class_id x_center y_center width height`, with coordinates
normalized to image size. Class IDs and names must match the evaluated model;
a custom single-class dataset cannot be compared directly to arbitrary COCO
class indices. Keep threshold/model tuning on validation data and reserve the
test split for the final assessment.

## 4. Compare speed

```powershell
.\.venv\Scripts\python.exe benchmark.py
.\.venv\Scripts\python.exe benchmark.py --source samples/ --iterations 100
.\.venv\Scripts\python.exe benchmark.py --models yolo26n.pt --device cpu
```

The benchmark preloads images, warms up each model five times, and runs 50
batch-one predictions at fixed 640x640 padding by default. GPU measurements
synchronize CUDA around each timed prediction. JSON and CSV reports under
`runs/benchmark_*` contain mean, median, 95th percentile, maximum latency, and
prediction throughput with configuration and environment details.

Timing includes preprocessing, prediction, and postprocessing. It excludes image
decoding, model loading, file writes, and display. `prediction_fps` therefore is
not full video pipeline FPS. Use the same images, device, image size, confidence,
and iteration count for comparisons. Different prediction padding defaults mean
per-stage times from `predict.py` need not equal these benchmark timings.

COCO8 scores and repeated-image speed measurements are initial checks. Use a
larger representative labeled dataset and a real camera/video pipeline before
choosing a model for an application.

## Files and outputs

- `predict.py`: image, directory, video, webcam detection.
- `evaluate.py`: labeled evaluation and model accuracy comparison.
- `benchmark.py`: warmed-up model latency comparison.
- `common.py`: shared model paths, device selection, and environment metadata.
- `models/`: downloaded model weights.
- `samples/`: user inputs and the public sample image.
- `datasets/`: downloaded evaluation data.
- `runs/`: annotated media, machine-readable reports, plots, and verification outputs.
- `.ultralytics/`: project-local Ultralytics configuration.

If GPU memory is insufficient, keep `--batch 1` for evaluation, choose the nano
model, reduce `--imgsz` to 320, or pass `--device cpu`. If a download fails, rerun
with an internet connection. User-provided file paths are resolved relative to
the terminal's current directory; generated outputs stay in this project.

## References

- [YOLO26 models](https://docs.ultralytics.com/models/yolo26)
- [Prediction API](https://docs.ultralytics.com/modes/predict)
- [Model testing and evaluation](https://docs.ultralytics.com/guides/model-testing)
- [PyTorch installation](https://pytorch.org/get-started/locally/)
