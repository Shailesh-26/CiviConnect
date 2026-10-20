import { Router } from "express";
import rateLimit from "express-rate-limit";
import { classifyVision, getVisionStats, getVisionStatus, listFixFlags, reviewFixFlag, searchByWords, similarToPhoto } from "../controllers/vision.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { photo } from "../middleware/upload";

export const visionRouter = Router();

const classifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many photos checked. Please wait a few minutes." },
});

visionRouter.use(authenticate);
visionRouter.get("/status", getVisionStatus);
visionRouter.post("/classify", classifyLimiter, photo("image"), classifyVision);
visionRouter.get("/stats", requireRole("admin"), getVisionStats);
visionRouter.post("/similar", classifyLimiter, similarToPhoto);
visionRouter.get("/search", requireRole("officer", "admin"), classifyLimiter, searchByWords);
visionRouter.get("/fix-flags", requireRole("admin"), listFixFlags);
visionRouter.post("/fix-flags/:id/review", requireRole("admin"), reviewFixFlag);
