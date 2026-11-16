export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;
  xyxy: number[];
};
export type Result = {
  id: string;
  filename: string;
  created_at: string;
  model: string;
  confidence: number;
  imgsz: number;
  width: number;
  height: number;
  original_url: string;
  annotated_url: string;
  detections: Detection[];
  prediction_ms: number;
  total_ms: number;
  cold_start: boolean;
  source: string;
  device: string;
};
export type ModelInfo = {
  id: string;
  name: string;
  family: string;
  description: string;
  size: string;
};
export type Health = {
  cloudinary_configured: boolean;
  environment: { hardware: string; device: string };
  models: string[];
  model_catalog: ModelInfo[];
};
export type Asset = {
  upload_id: string;
  public_id: string;
  version: number;
  signature: string;
};
type Authorization = {
  upload_id: string;
  url: string;
  fields: Record<string, string | number>;
};
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.json();
}
export async function upload(file: File): Promise<Asset> {
  const auth = await api<Authorization>("/api/uploads/signature", {
    method: "POST",
  });
  const body = new FormData();
  Object.entries(auth.fields).forEach(([key, value]) =>
    body.append(key, String(value)),
  );
  body.append("file", file);
  const response = await fetch(auth.url, { method: "POST", body });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  return {
    upload_id: auth.upload_id,
    public_id: data.public_id,
    version: data.version,
    signature: data.signature,
  };
}
