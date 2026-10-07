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

export function uploadImage(buffer: Buffer): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "civiconnect/issues",
        resource_type: "image",
        transformation: [{ width: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Image upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}
