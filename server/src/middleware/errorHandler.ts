import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Please fix the highlighted fields",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, ...(err.data ?? {}) });
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each photo must be 5 MB or smaller"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
          ? "You can attach up to 3 photos"
          : "Photo upload failed";
    res.status(400).json({ message });
    return;
  }

  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Request body is not valid JSON" });
    return;
  }

  if (err?.type === "entity.too.large") {
    res.status(413).json({ message: "That is too much data to send at once" });
    return;
  }

  if (err?.name === "CastError") {
    res.status(400).json({ message: "Something in the request is not valid" });
    return;
  }

  // Saved with a condition (see doc.$where), or a list inside it changed: someone else changed the record first.
  if (err?.name === "DocumentNotFoundError" || err?.name === "VersionError") {
    res.status(409).json({ message: "Someone else changed this just now. Refresh to see the latest and try again." });
    return;
  }

  if (err?.code === 11000) {
    res.status(409).json({ message: "A record with this value already exists" });
    return;
  }

  console.error(err);
  res.status(500).json({
    message: env.NODE_ENV === "production" ? "Something went wrong" : String(err?.message ?? err),
  });
};
