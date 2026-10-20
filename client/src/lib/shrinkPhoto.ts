// Phone photos are often 4-12 MB (48 MP cameras). Before uploading, big photos are redrawn at most
// 2048 px on the long side as JPEG: plenty for officers, far quicker on mobile data, and well under
// the 5 MB limit. Location and camera details in the original file are dropped too (privacy).
// If the browser can't read the photo, the original is used unchanged.
const MAX_SIDE = 2048;
const SHRINK_ABOVE_BYTES = 1.2 * 1024 * 1024;

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SHRINK_ABOVE_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export const shrinkPhotos = (files: File[]) => Promise.all(files.map(shrinkPhoto));

// A file's name and type can lie (a PDF renamed to photo.jpg). Its first bytes don't: JPEG, PNG and
// WebP each start with a fixed signature. The server checks the same thing.
export async function isRealPhoto(file: File) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b.length < 12) return false;
  const text = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && text(1, 4) === "PNG";
  const webp = text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
  return jpeg || png || webp;
}

/** Splits picked files into real photos and the rest. */
export async function realPhotos(files: File[]) {
  const checks = await Promise.all(files.map(isRealPhoto));
  return { real: files.filter((_, i) => checks[i]), fake: files.filter((_, i) => !checks[i]) };
}
