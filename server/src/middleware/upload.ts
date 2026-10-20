import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "Only JPEG, PNG or WebP images are allowed"));
  },
});

// The browser's file type can be faked (a PDF renamed to .jpg), so look at the file's first bytes too.
export function looksLikeImage(b: Buffer) {
  if (b.length < 12) return false;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return jpeg || png || webp;
}

const realImagesOnly: RequestHandler = (req, _res, next) => {
  const files = [...((req.files as Express.Multer.File[] | undefined) ?? []), ...(req.file ? [req.file] : [])];
  if (files.some((f) => !looksLikeImage(f.buffer))) {
    throw new AppError(400, "That file is not a real photo. Use a JPEG, PNG or WebP image.");
  }
  next();
};

/** Up to `max` photos in `field`, checked to be real images. */
export const photos = (field: string, max: number) => [upload.array(field, max), realImagesOnly];
/** One photo in `field`, checked to be a real image. */
export const photo = (field: string) => [upload.single(field), realImagesOnly];
