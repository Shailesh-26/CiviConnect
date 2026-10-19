import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { CATEGORIES, type Category } from "../models/Issue";
import { imageStorageEnabled } from "../utils/cloudinary";

/**
 * Real photos for the demo city, taken from folders on your own computer and uploaded once to
 * your own Cloudinary account. Nothing here is committed to GitHub.
 *
 *   civic_dataset/<category>/   "before" photos (the same folders you trained the model with)
 *   demo-after/<category>/      optional "after" photos for fixed issues (photos you are allowed to use)
 *
 * Both live in the project folder, next to client/ and server/. Any category without photos keeps
 * the drawn illustration (as do the demo "other" issues, which the dataset doesn't show). Uploads are remembered in server/.demo-photos.json, so seeding again is instant.
 */

export type DemoImage = { url: string; publicId: string };
export type DemoPhotoSet = { before: Partial<Record<Category, DemoImage[]>>; after: Partial<Record<Category, DemoImage[]>> };

const ROOT = path.resolve(__dirname, "../../..");
const CACHE_FILE = path.resolve(__dirname, "../../.demo-photos.json");
const PER_CATEGORY = 8;
const MAX_BYTES = 9.5 * 1024 * 1024; // Cloudinary's free plan refuses images over 10 MB
const IMAGE = /\.(jpe?g|png|webp)$/i;

type Cache = Record<string, DemoImage>;

function readCache(): Cache {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Cache;
  } catch {
    return {};
  }
}

function pickFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => IMAGE.test(f))
    .map((f) => path.join(dir, f))
    .filter((f) => {
      const size = statSync(f).size;
      return size > 15_000 && size < MAX_BYTES; // skip tiny thumbnails and files too big to upload
    })
    .sort();
  if (files.length <= PER_CATEGORY) return files;
  // Spread the picks across the folder instead of taking the first few.
  const step = files.length / PER_CATEGORY;
  return Array.from({ length: PER_CATEGORY }, (_, i) => files[Math.floor(i * step)]);
}

async function upload(file: string, publicId: string, cache: Cache): Promise<DemoImage | null> {
  const key = `${path.relative(ROOT, file)}:${statSync(file).size}`;
  if (cache[key]) return cache[key];
  try {
    const res = await cloudinary.uploader.upload(file, {
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
      transformation: [{ width: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
    });
    const image = { url: res.secure_url, publicId: res.public_id };
    cache[key] = image;
    return image;
  } catch (err) {
    console.warn(`  Skipped ${path.relative(ROOT, file)}: ${(err as Error).message ?? err}`);
    return null;
  }
}

export async function loadDemoPhotos(): Promise<DemoPhotoSet> {
  const set: DemoPhotoSet = { before: {}, after: {} };
  const beforeRoot = process.env.DEMO_PHOTOS_DIR ? path.resolve(process.env.DEMO_PHOTOS_DIR) : path.join(ROOT, "civic_dataset");
  const afterRoot = path.join(ROOT, "demo-after");
  const hasAny = existsSync(beforeRoot) || existsSync(afterRoot);
  if (!hasAny) {
    console.log("No civic_dataset/ or demo-after/ folder found: using the drawn demo pictures.");
    return set;
  }
  if (!imageStorageEnabled) {
    console.log("Cloudinary is not set up in .env: using the drawn demo pictures.");
    return set;
  }

  const cache = readCache();
  let uploaded = 0;
  for (const kind of ["before", "after"] as const) {
    const root = kind === "before" ? beforeRoot : afterRoot;
    for (const category of CATEGORIES) {
      // Demo "other" issues are signboards, footpaths and dividers, which the dataset's "other" photos don't show.
      if (category === "other" && kind === "before") continue;
      const files = pickFiles(path.join(root, category));
      const images: DemoImage[] = [];
      for (const [i, file] of files.entries()) {
        const fresh = !cache[`${path.relative(ROOT, file)}:${statSync(file).size}`];
        if (fresh && uploaded === 0) console.log("Uploading demo photos to Cloudinary (only the first time)…");
        const image = await upload(file, `civiconnect/demo/${kind}-${category}-${i + 1}`, cache);
        if (image) {
          images.push(image);
          if (fresh) uploaded++;
        }
      }
      if (images.length) set[kind][category] = images;
    }
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  const count = (s: DemoPhotoSet["before"]) => Object.values(s).reduce((n, list) => n + (list?.length ?? 0), 0);
  console.log(`Demo photos: ${count(set.before)} before, ${count(set.after)} after${uploaded ? ` (${uploaded} uploaded now)` : ""}.`);
  const drawnAfter = CATEGORIES.filter((c) => !set.after[c]);
  if (drawnAfter.length) console.log(`Drawn "after" pictures used for: ${drawnAfter.join(", ")} (add photos in demo-after/<category>/ to replace them).`);
  return set;
}
