import { Router } from "express";
import { controlSimulator, getAreas, getChronic, getMyCivic, getSimulator, getTimeline } from "../controllers/insights.controller";
import { authenticate, requireRole } from "../middleware/auth";

export const insightsRouter = Router();
insightsRouter.use(authenticate);
insightsRouter.get("/chronic", getChronic);
insightsRouter.get("/areas", getAreas);
insightsRouter.get("/timeline", getTimeline);
insightsRouter.get("/civic", getMyCivic);
insightsRouter.get("/simulator", requireRole("admin"), getSimulator);
insightsRouter.post("/simulator", requireRole("admin"), controlSimulator);
