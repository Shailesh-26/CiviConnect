import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  assignIssue,
  createIssue,
  getIssue,
  listAssigned,
  listIssues,
  listMine,
  supportIssue,
  updateStatus,
} from "../controllers/issue.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validateBody } from "../middleware/validate";
import { assignSchema, createIssueSchema, statusSchema } from "../validators/issue.schemas";

export const issueRouter = Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You have submitted a lot of reports. Please try again later." },
});

issueRouter.use(authenticate);

issueRouter.post("/", createLimiter, upload.array("photos", 3), validateBody(createIssueSchema), createIssue);
issueRouter.get("/", listIssues);
issueRouter.get("/mine", listMine);
issueRouter.get("/assigned", requireRole("officer"), listAssigned);
issueRouter.get("/:id", getIssue);
issueRouter.post("/:id/support", supportIssue);
issueRouter.patch("/:id/assign", requireRole("admin"), validateBody(assignSchema), assignIssue);
issueRouter.patch("/:id/status", requireRole("admin", "officer"), validateBody(statusSchema), updateStatus);
