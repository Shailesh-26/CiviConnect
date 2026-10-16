import { Router } from "express";
import rateLimit from "express-rate-limit";
import { classifyVision, getVisionStats, getVisionStatus } from "../controllers/vision.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { upload } from "../middleware/upload";

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
visionRouter.post("/classify", classifyLimiter, upload.single("image"), classifyVision);
visionRouter.get("/stats", requireRole("admin"), getVisionStats);
