import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Code2,
  Columns2,
  Cpu,
  Crosshair,
  ExternalLink,
  FileImage,
  FolderClock,
  Layers3,
  LoaderCircle,
  ScanLine,
  Settings2,
  Sparkles,
  Timer,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { api, upload } from "./api";
import type { Asset, Health, Result } from "./api";
import "./dashboard.css";

const palette = ["#159775", "#bd8a39", "#8e79c9", "#d9768c", "#459fb9"];
export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<Result[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [model, setModel] = useState("yolo26n.pt");
  const [confidence, setConfidence] = useState(25);
  const [size, setSize] = useState(640);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("/api/sample");
  const [sample, setSample] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState("bus.jpg");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState("detection");
  const [split, setSplit] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState("playground");
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await api<Health>("/api/health");
        if (active) {
          setHealth(data);
          setConnected(true);
        }
      } catch {
        if (active) setConnected(false);
      }
    };
    void refresh();
    api<Result[]>("/api/predictions")
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch(() => {});
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function choose(selected?: File) {
    if (!selected || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Your image must be 10 MB or smaller.");
      return;
    }
    setFile(selected);
    setSourceName(selected.name);
    setPreviousId(null);
    setPreview(URL.createObjectURL(selected));
    setSample(false);
    setAsset(null);
    setResult(null);
    setError("");
    setSplit(false);
  }
  function chooseSample() {
    if (busy) return;
    setFile(null);
    setSourceName("bus.jpg");
    setPreviousId(null);
    setPreview("/api/sample");
    setSample(true);
    setAsset(null);
    setResult(null);
    setError("");
    setSplit(false);
  }
  async function run() {
    setError("");
    try {
      let uploaded = asset;
      if (!sample && !uploaded && !previousId) {
        if (!file) throw new Error("Choose an image first.");
        if (!health?.cloudinary_configured) {
          dialog.current?.showModal();
          return;
        }
        setBusy("Uploading to Cloudinary…");
        uploaded = await upload(file);
        setAsset(uploaded);
      }
      setBusy("Running object detection…");
      const prediction = await api<Result>("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          confidence: confidence / 100,
          imgsz: size,
          sample,
          asset: sample ? null : uploaded,
          previous_id: previousId,
          filename: sourceName,
        }),
      });
      setResult(prediction);
      setView("detection");
      setPage("playground");
      setHistory((previous) =>
        [
          prediction,
          ...previous.filter((item) => item.id !== prediction.id),
        ].slice(0, 50),
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy("");
    }
  }
  async function openResult(id: string) {
    try {
      const data = await api<Result>(`/api/predictions/${id}`);
      setResult(data);
      setPage("playground");
      setView("detection");
      setSplit(false);
      setError("");
      setPreviousId(data.id);
      setSample(false);
      setAsset(null);
      setFile(null);
      setSourceName(data.filename);
      setPreview(data.original_url);
      setModel(data.model);
      setConfidence(Math.round(data.confidence * 100));
      setSize(data.imgsz);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not open this test.",
      );
    }
  }
  const classes = [
    ...new Set(result?.detections.map((item) => item.class_name) || []),
  ];
  const average = result?.detections.length
    ? result.detections.reduce((sum, item) => sum + item.confidence, 0) /
      result.detections.length
    : null;
  const stats = [
    {
      label: "Objects detected",
      value: result ? String(result.detections.length).padStart(2, "0") : "—",
      icon: Crosshair,
      note: "Every detail, accounted for",
      color: "green",
    },
    {
      label: "Unique classes",
      value: result ? String(classes.length).padStart(2, "0") : "—",
      icon: Layers3,
      note: "Across 80 pretrained classes",
      color: "purple",
    },
    {
      label: "Avg. confidence",
      value: average !== null ? `${(average * 100).toFixed(1)}%` : "—",
      icon: ScanLine,
      note: "Of the detected objects",
      color: "orange",
    },
    {
      label: "Prediction time",
      value: result ? `${result.prediction_ms.toFixed(0)}` : "—",
      unit: result ? "ms" : "",
      icon: Timer,
      note: result?.cold_start
        ? "First run includes warm-up"
        : "Preprocess + inference + postprocess",
      color: "blue",
    },
  ];
  function recentTable(full = false) {
    return (
      <section className="history-card">
        <div className="section-heading">
          <div>
            <FolderClock size={18} />
            <h2>{full ? "Test history" : "Recent tests"}</h2>
            <span className="count">{history.length}</span>
          </div>
          {!full && (
            <button className="text-button" onClick={() => setPage("history")}>
              View all tests <ArrowRight size={14} />
            </button>
          )}
        </div>
        {history.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>IMAGE</th>
                  <th>MODEL</th>
                  <th>DETECTIONS</th>
                  <th>PREDICTION</th>
                  <th>TESTED</th>
                  <th>
                    <span className="sr-only">Open test</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, full ? 50 : 4).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="history-image"
                        disabled={!!busy}
                        onClick={() => void openResult(item.id)}
                      >
                        <img src={item.original_url} alt="" />
                        <span>
                          {item.filename}
                          <small>
                            {item.width} × {item.height} px
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="model-tag">
                        YOLO26{item.model.includes("n.") ? "n" : "s"}
                      </span>
                    </td>
                    <td>{item.detections.length} objects</td>
                    <td>{item.prediction_ms.toFixed(0)} ms</td>
                    <td>
                      {new Date(item.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open test ${item.filename}`}
                        disabled={!!busy}
                        onClick={() => void openResult(item.id)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="history-empty">
            <FolderClock size={25} />
            <p>A little history starts with your first test.</p>
            <span>Run a detection and your results will be saved here.</span>
          </div>
        )}
      </section>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-symbol">
            <ScanLine size={25} />
          </span>
          <span>
            YOLO<span className="brand-number">26</span>
            <small>VISION STUDIO</small>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Workspace">
          <button
            className={`nav-item ${page === "playground" ? "active" : ""}`}
            onClick={() => setPage("playground")}
            aria-label="Image playground"
          >
            <ScanLine size={19} />
            <span>Image playground</span>
            <i />
          </button>
          <button
            className={`nav-item ${page === "history" ? "active" : ""}`}
            onClick={() => setPage("history")}
            aria-label="Test history"
          >
            <FolderClock size={19} />
            <span>Test history</span>
            <b>{history.length}</b>
          </button>
        </nav>
        <div className="workspace-label library-label">
          MODEL LIBRARY <span>02</span>
        </div>
        {["n", "s"].map((variant, index) => (
          <button
            key={variant}
            className="library-item"
            disabled={!!busy}
            onClick={() => {
              setModel(`yolo26${variant}.pt`);
              setPage("playground");
            }}
          >
            <span className={`library-icon ${index ? "purple" : ""}`}>
              {index ? <Layers3 size={16} /> : <Zap size={16} />}
            </span>
            <span>
              YOLO26 {index ? "Small" : "Nano"}
              <small>
                {index ? "A little more detail" : "Lightweight & fast"}
              </small>
            </span>
            {model === `yolo26${variant}.pt` && <Check size={14} />}
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="engine-status">
            <div>
              <i className={`status-dot ${connected ? "" : "offline"}`} />
              <strong>
                {connected ? "Inference engine online" : "Connecting to engine"}
              </strong>
            </div>
            <span>
              {health?.environment.hardware || "Local Python backend"}
            </span>
            <small>
              <Cpu size={12} />
              {connected
                ? health?.environment.device === "cpu"
                  ? "CPU inference"
                  : "GPU acceleration enabled"
                : "Waiting for connection"}
            </small>
          </div>
          <a
            className="repo-link"
            href="https://github.com/Eyobhailu24/YOLO26"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={16} />
            Project repository
            <ExternalLink size={13} />
          </a>
          <div className="sidebar-signature">
            BUILT TO SEE MORE<span>v1.0</span>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={13} />
            <span>
              {page === "playground" ? "Image playground" : "Test history"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <i className="status-dot" />
              Local workspace
            </span>
            <button
              className="icon-button"
              aria-label="Cloudinary setup help"
              onClick={() => dialog.current?.showModal()}
            >
              <CircleHelp size={19} />
            </button>
            <span className="avatar">EY</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <i />
                YOUR VISION, IN FOCUS
              </div>
              <h1>
                {page === "playground"
                  ? "See what your model sees."
                  : "Every test. A clearer picture."}
              </h1>
              <p>
                {page === "playground"
                  ? "Drop in an image. Explore what YOLO26 can discover."
                  : "Revisit your images, detections, and model experiments."}
              </p>
            </div>
            <span className="version-badge">
              <Sparkles size={14} />
              Powered by YOLO26
            </span>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!connected && (
            <div className="connection-banner" role="status">
              Connecting to the local inference server. Start the dashboard
              launcher if this message persists.
            </div>
          )}
          {page === "playground" ? (
            <>
              <section className="stats-grid" aria-label="Detection summary">
                {stats.map(
                  ({ label, value, unit, icon: Icon, note, color }) => (
                    <div className="stat-card" key={label}>
                      <div className="stat-top">
                        <span>{label}</span>
                        <span className={`stat-icon ${color}`}>
                          <Icon size={17} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {value}
                        <small>{unit}</small>
                      </div>
                      <p>{note}</p>
                    </div>
                  ),
                )}
              </section>
              <section className="playground-grid">
                <section className="control-card">
                  <div className="section-heading">
                    <div>
                      <Settings2 size={17} />
                      <h2>Test configuration</h2>
                    </div>
                    <span className="step-label">01</span>
                  </div>
                  <div className="control-body">
                    <label className="field-label">SOURCE IMAGE</label>
                    <button
                      className={`dropzone ${dragging ? "dragging" : ""}`}
                      disabled={!!busy}
                      onClick={() => input.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        choose(event.dataTransfer.files[0]);
                      }}
                    >
                      <span className="upload-icon">
                        <UploadCloud size={25} />
                      </span>
                      <strong>Drop your image here</strong>
                      <span>
                        or <em>browse files</em>
                      </span>
                      <small>JPG, PNG or WebP · up to 10 MB</small>
                    </button>
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload image"
                      ref={input}
                      onChange={(event) => {
                        choose(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                    <div className="selected-file">
                      <img src={preview} alt="Selected image thumbnail" />
                      <span>
                        {sourceName}
                        <small>
                          {sample
                            ? "Sample image · ready to test"
                            : previousId
                              ? "Saved test · ready to rerun"
                              : asset
                                ? "Uploaded to Cloudinary"
                                : "Ready to upload"}
                        </small>
                      </span>
                      <Check size={15} />
                    </div>
                    <button
                      className="sample-button"
                      disabled={!!busy}
                      onClick={chooseSample}
                    >
                      <FileImage size={14} />
                      Try the sample image
                      <ArrowRight size={13} />
                    </button>
                    <div className="control-divider" />
                    <label className="field-label" htmlFor="model">
                      DETECTION MODEL
                    </label>
                    <div className="select-wrapper">
                      <Zap size={16} />
                      <select
                        id="model"
                        disabled={!!busy}
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                      >
                        <option value="yolo26n.pt">YOLO26 Nano</option>
                        <option value="yolo26s.pt">YOLO26 Small</option>
                      </select>
                    </div>
                    <p className="field-hint">
                      {model === "yolo26n.pt"
                        ? "A fast, lightweight starting point."
                        : "A larger model for your next comparison."}
                    </p>
                    <div className="confidence-label">
                      <label className="field-label" htmlFor="confidence">
                        CONFIDENCE THRESHOLD
                      </label>
                      <span>{confidence}%</span>
                    </div>
                    <input
                      id="confidence"
                      type="range"
                      min="1"
                      max="95"
                      value={confidence}
                      disabled={!!busy}
                      onChange={(event) =>
                        setConfidence(Number(event.target.value))
                      }
                      style={
                        {
                          "--range-progress": `${((confidence - 1) / 94) * 100}%`,
                        } as CSSProperties
                      }
                    />
                    <div className="range-labels">
                      <span>More detections</span>
                      <span>Higher confidence</span>
                    </div>
                    <label
                      className="field-label resolution-label"
                      htmlFor="resolution"
                    >
                      INPUT RESOLUTION
                    </label>
                    <select
                      className="resolution-select"
                      id="resolution"
                      value={size}
                      disabled={!!busy}
                      onChange={(event) => setSize(Number(event.target.value))}
                    >
                      <option value={320}>320 × 320 · Faster</option>
                      <option value={640}>640 × 640 · Balanced</option>
                      <option value={960}>960 × 960 · More detail</option>
                    </select>
                    <button
                      className="run-button"
                      disabled={!!busy || !connected}
                      onClick={() => void run()}
                    >
                      {busy ? (
                        <LoaderCircle size={17} className="spin" />
                      ) : (
                        <ScanLine size={18} />
                      )}
                      <span>{busy || "Run detection"}</span>
                      {!busy && <ArrowRight size={17} />}
                    </button>
                    <button
                      className={`cloud-status ${health?.cloudinary_configured ? "configured" : ""}`}
                      onClick={() => dialog.current?.showModal()}
                    >
                      <Cloud size={14} />
                      {health?.cloudinary_configured
                        ? "Cloudinary configured"
                        : "Set up Cloudinary for uploads"}
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </section>
                <section className="results-card">
                  <div className="section-heading">
                    <div>
                      <Crosshair size={18} />
                      <h2>Detection canvas</h2>
                      {result && (
                        <span className="complete-pill">
                          <Check size={11} />
                          Complete
                        </span>
                      )}
                    </div>
                    <span className="step-label">02</span>
                  </div>
                  <div className="canvas-toolbar">
                    <div className="view-tabs">
                      {["detection", "original"].map((tab) => (
                        <button
                          key={tab}
                          className={view === tab ? "selected" : ""}
                          onClick={() => {
                            setView(tab);
                            setSplit(false);
                          }}
                        >
                          {tab === "detection" ? "Detection" : "Original"}
                        </button>
                      ))}
                    </div>
                    <div className="canvas-actions">
                      <button
                        className={`icon-button ${split ? "selected" : ""}`}
                        aria-label="Compare original and detection"
                        disabled={!result}
                        onClick={() => setSplit(!split)}
                      >
                        <Columns2 size={17} />
                      </button>
                      {result && (
                        <a
                          className="icon-button"
                          aria-label="Download annotated image"
                          href={`/api/predictions/${result.id}/download?kind=image`}
                        >
                          <ArrowDownToLine size={17} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div
                    className={`canvas ${split ? "split" : ""}`}
                    aria-busy={!!busy}
                  >
                    {split && result ? (
                      <>
                        <div>
                          <span className="image-label">ORIGINAL</span>
                          <img src={result.original_url} alt="Original image" />
                        </div>
                        <div>
                          <span className="image-label">DETECTION</span>
                          <img
                            src={result.annotated_url}
                            alt="YOLO26 detections"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          className={!result ? "preview-image" : ""}
                          src={
                            result
                              ? view === "detection"
                                ? result.annotated_url
                                : result.original_url
                              : preview
                          }
                          alt={
                            result && view === "detection"
                              ? "YOLO26 annotated detections"
                              : "Image preview"
                          }
                        />
                        {!result && !busy && (
                          <div className="preview-caption">
                            <span>
                              <ScanLine size={15} />
                              Ready when you are.
                            </span>
                            <small>
                              Run detection to reveal the objects in this image.
                            </small>
                          </div>
                        )}
                      </>
                    )}
                    {busy && (
                      <div className="processing-overlay" role="status">
                        <LoaderCircle className="spin" size={30} />
                        <strong>{busy}</strong>
                        <span>The first run may take a little longer.</span>
                      </div>
                    )}
                  </div>
                  <div className="canvas-footer">
                    <span>
                      <i className={`status-dot ${result ? "" : "muted"}`} />
                      {result
                        ? `${result.width} × ${result.height} px · ${result.filename}`
                        : sample
                          ? "Sample image loaded"
                          : "Image ready for testing"}
                    </span>
                    <span>
                      {result
                        ? `${result.total_ms.toFixed(0)} ms total`
                        : "80 COCO classes"}
                    </span>
                  </div>
                  <div className="detections-panel">
                    <div className="detection-heading">
                      <h3>
                        Detected objects{" "}
                        <span>{result?.detections.length || 0}</span>
                      </h3>
                      {result && (
                        <a
                          className="text-button"
                          href={`/api/predictions/${result.id}/download?kind=json`}
                        >
                          Export JSON <ArrowDownToLine size={13} />
                        </a>
                      )}
                    </div>
                    {result?.detections.length ? (
                      <div className="detection-list">
                        {result.detections.map((item, index) => (
                          <div className="detection-row" key={index}>
                            <span className="object-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <i
                              className="object-dot"
                              style={{
                                background:
                                  palette[
                                    classes.indexOf(item.class_name) %
                                      palette.length
                                  ],
                              }}
                            />
                            <span className="object-name">
                              {item.class_name}
                            </span>
                            <div className="confidence-track">
                              <span
                                style={{
                                  width: `${item.confidence * 100}%`,
                                  background:
                                    palette[
                                      classes.indexOf(item.class_name) %
                                        palette.length
                                    ],
                                }}
                              />
                            </div>
                            <strong>
                              {(item.confidence * 100).toFixed(1)}%
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-detections">
                        <Crosshair size={19} />
                        <span>
                          {result
                            ? "No objects found. Try a lower confidence threshold."
                            : "Your detections will appear here."}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              </section>
              {recentTable()}
            </>
          ) : (
            recentTable(true)
          )}
          <footer className="page-footer">
            <span>
              <ScanLine size={13} />
              YOLO26 Studio<span>·</span>A closer look at computer vision.
            </span>
            <span>
              Running locally
              <i className="status-dot" />
            </span>
          </footer>
        </div>
      </main>
      <dialog ref={dialog} className="setup-dialog" aria-labelledby="cloudinary-title">
        <div className="dialog-heading">
          <span className="upload-icon">
            <Cloud size={25} />
          </span>
          <button
            className="icon-button"
            aria-label="Close setup"
            onClick={() => dialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        <div className="eyebrow">CONNECT YOUR MEDIA</div>
        <h2 id="cloudinary-title">Make room for your own images.</h2>
        <p>
          Connect a Cloudinary product environment to upload images directly
          from this dashboard.
        </p>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> in the project
            directory.
          </li>
          <li>
            Enter your cloud name, API key, and API secret from your Cloudinary
            dashboard.
          </li>
          <li>Restart the dashboard launcher, then upload your image.</li>
        </ol>
        <pre>
          CLOUDINARY_CLOUD_NAME=your_cloud_name{"\n"}
          CLOUDINARY_API_KEY=your_api_key{"\n"}
          CLOUDINARY_API_SECRET=your_api_secret
        </pre>
        <div className="dialog-note">
          <Check size={15} />
          Your API secret stays on the Python server.
        </div>
        <p className="dialog-storage">
          Original uploads are stored in your Cloudinary account. Test history
          and annotated results are saved locally.
        </p>
        <button
          className="run-button"
          onClick={() => {
            dialog.current?.close();
            chooseSample();
            setPage("playground");
          }}
        >
          Try the sample meanwhile
          <ArrowRight size={17} />
        </button>
      </dialog>
    </div>
  );
}
