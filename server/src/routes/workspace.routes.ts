import { Router } from "express";
import { exportCsv, getAnalytics } from "../controllers/analytics.controller";
import { desk, setMyLeave } from "../controllers/officer.controller";
import { validateBody } from "../middleware/validate";
import { leaveSchema } from "../validators/admin.schemas";
import { authenticate, requireRole } from "../middleware/auth";

export const officerRouter = Router();
officerRouter.get("/desk", authenticate, requireRole("officer"), desk);
officerRouter.patch("/leave", authenticate, requireRole("officer"), validateBody(leaveSchema), setMyLeave);

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, requireRole("officer", "admin"));
analyticsRouter.get("/", getAnalytics);
analyticsRouter.get("/export.csv", exportCsv);
