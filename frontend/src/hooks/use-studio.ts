import { useEffect, useState } from "react";
import { api, upload } from "@/api";
import type { Asset, Health, Result } from "@/api";

const OUTDATED_BACKEND =
  "The running backend is outdated. Restart start-dashboard.ps1 to load the full model list.";

export function useStudio() {
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
  const [setupOpen, setSetupOpen] = useState(false);
  const [page, setPage] = useState("playground");
  const [view, setView] = useState("detection");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const data = await api<Health>("/api/health", { cache: "no-store" });
        if (active) {
          if (
            !Array.isArray(data.model_catalog) ||
            !data.model_catalog.length
          ) {
            setHealth(null);
            setConnected(false);
            setError(OUTDATED_BACKEND);
            return;
          }
          setHealth(data);
          setConnected(true);
          setError((previous) =>
            previous === OUTDATED_BACKEND ? "" : previous,
          );
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
      .catch(() => {
        if (active)
          setError(
            "Could not load test history. Refresh the page to try again.",
          );
      });
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
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Images must be 10 MB or smaller.");
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
    setView("detection");
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
    setView("detection");
    setPage("playground");
  }
  async function run() {
    if (busy) return;
    setError("");
    try {
      let uploaded = asset;
      if (!sample && !uploaded && !previousId) {
        if (!file) throw new Error("Choose an image first.");
        if (!health?.cloudinary_configured) {
          setSetupOpen(true);
          return;
        }
        setBusy("Uploading to Cloudinary…");
        uploaded = await upload(file);
        setAsset(uploaded);
      }
      setBusy("Running detection…");
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
      setPreviousId(prediction.id);
      setAsset(null);
      setSample(false);
      setFile(null);
      setPreview(prediction.original_url);
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
          : "Detection failed. Please try again.",
      );
    } finally {
      setBusy("");
    }
  }
  async function openResult(id: string) {
    if (busy) return;
    try {
      const data = await api<Result>(`/api/predictions/${id}`);
      setResult(data);
      setPage("playground");
      setView("detection");
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
  return {
    health,
    connected,
    history,
    result,
    model,
    setModel,
    confidence,
    setConfidence,
    size,
    setSize,
    preview,
    sample,
    previousId,
    sourceName,
    busy,
    error,
    setError,
    setupOpen,
    setSetupOpen,
    page,
    setPage,
    view,
    setView,
    choose,
    chooseSample,
    run,
    openResult,
  };
}
