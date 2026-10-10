import { Router } from "express";
import { exportCsv, getAnalytics } from "../controllers/analytics.controller";
import { desk } from "../controllers/officer.controller";
import { authenticate, requireRole } from "../middleware/auth";

export const officerRouter = Router();
officerRouter.get("/desk", authenticate, requireRole("officer"), desk);

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, requireRole("officer", "admin"));
analyticsRouter.get("/", getAnalytics);
analyticsRouter.get("/export.csv", exportCsv);
