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
