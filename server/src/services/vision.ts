import { env } from "../config/env";

// Talks to the local Photo Assistant (ml/ folder, FastAPI). The app works fully without it:
// every function here returns null when the service is not running.

export type VisionResult = {
  verdict: "confident" | "unsure" | "not_civic";
  category: string | null;
  confidence: number;
  civic: number;
  top: { category: string; score: number }[];
  quality: { sharpness: number; brightness: number; blurry: boolean; dark: boolean };
  model: { name: string; mode: "zero-shot" | "trained" };
  ms: number;
};

export type VisionHealth = {
  ok: boolean;
  loadSeconds: number | null;
  model: { name: string; mode: "zero-shot" | "trained"; classes: string[]; metrics: Record<string, unknown> | null };
};

const base = () => env.VISION_URL.replace(/\/+$/, "");

let healthCache: { at: number; value: VisionHealth | null } | null = null;

export async function visionHealth(fresh = false): Promise<VisionHealth | null> {
  if (!fresh && healthCache && Date.now() - healthCache.at < 15_000) return healthCache.value;
  let value: VisionHealth | null = null;
  try {
    const res = await fetch(`${base()}/health`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) value = (await res.json()) as VisionHealth;
  } catch {
    value = null;
  }
  healthCache = { at: Date.now(), value };
  return value;
}

export async function classifyPhoto(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<VisionResult | null> {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname || "photo.jpg");
  try {
    // The first request after the service starts can be slow while the model warms up.
    const res = await fetch(`${base()}/classify`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    healthCache = null;
    return (await res.json()) as VisionResult;
  } catch {
    healthCache = { at: Date.now(), value: null };
    return null;
  }
}

type UploadFile = { buffer: Buffer; mimetype: string; originalname: string };

/**
 * Privacy filter for uploaded photos: faces are blurred by the Photo Assistant before anything is stored.
 * If the service is not running, photos are stored as they are (the app never blocks on it).
 */
export async function blurFaces(files: UploadFile[]): Promise<{ buffers: Buffer[]; faces: number }> {
  let faces = 0;
  const buffers = await Promise.all(
    files.map(async (file) => {
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname || "photo.jpg");
      try {
        const res = await fetch(`${base()}/privacy/blur`, { method: "POST", body: form, signal: AbortSignal.timeout(10_000) });
        if (res.status !== 200) return file.buffer;
        faces += Number(res.headers.get("x-faces-blurred") ?? 0) || 0;
        return Buffer.from(await res.arrayBuffer());
      } catch {
        return file.buffer;
      }
    }),
  );
  return { buffers, faces };
}
