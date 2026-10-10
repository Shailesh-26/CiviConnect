import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

export const imageStorageEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (imageStorageEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const ISSUE_TRANSFORM = [{ width: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }];
const AVATAR_TRANSFORM = [{ width: 320, height: 320, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" }];

export function uploadImage(buffer: Buffer, kind: "issue" | "avatar" = "issue"): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: kind === "avatar" ? "civiconnect/avatars" : "civiconnect/issues",
        resource_type: "image",
        transformation: kind === "avatar" ? AVATAR_TRANSFORM : ISSUE_TRANSFORM,
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Image upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

// Best effort: a failed delete must never break the request that replaced the image.
export async function deleteImage(publicId?: string | null) {
  if (!imageStorageEnabled || !publicId || publicId.startsWith("demo/")) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("Could not delete old image", publicId, err);
  }
}
