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
  verifyIssue,
} from "../controllers/issue.controller";
import {
  addComment,
  flagIssue,
  getNearby,
  listComments,
  toggleFollow,
  toggleHide,
} from "../controllers/community.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validateBody } from "../middleware/validate";
import { commentSchema, flagSchema } from "../validators/community.schemas";
import { assignSchema, createIssueSchema, statusSchema, verifySchema } from "../validators/issue.schemas";
import { flagLimiter } from "./community.routes";

export const issueRouter = Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You have submitted a lot of reports. Please try again later." },
});

const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You are commenting very fast. Please wait a few minutes." },
});

issueRouter.use(authenticate);

issueRouter.post("/", createLimiter, upload.array("photos", 3), validateBody(createIssueSchema), createIssue);
issueRouter.get("/", listIssues);
issueRouter.get("/mine", listMine);
issueRouter.get("/nearby", getNearby);
issueRouter.get("/assigned", requireRole("officer"), listAssigned);
issueRouter.get("/:id", getIssue);
issueRouter.post("/:id/support", supportIssue);
issueRouter.patch("/:id/assign", requireRole("admin"), validateBody(assignSchema), assignIssue);
issueRouter.patch(
  "/:id/status",
  requireRole("admin", "officer"),
  upload.array("photos", 2),
  validateBody(statusSchema),
  updateStatus,
);
issueRouter.post("/:id/verify", requireRole("citizen"), validateBody(verifySchema), verifyIssue);
issueRouter.get("/:id/comments", listComments);
issueRouter.post("/:id/comments", commentLimiter, upload.array("photos", 2), validateBody(commentSchema), addComment);
issueRouter.post("/:id/follow", toggleFollow);
issueRouter.post("/:id/hide", toggleHide);
issueRouter.post("/:id/flag", flagLimiter, validateBody(flagSchema), flagIssue);
