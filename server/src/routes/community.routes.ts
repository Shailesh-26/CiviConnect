import { Router } from "express";
import rateLimit from "express-rate-limit";
import { deleteComment, flagComment, getFeed } from "../controllers/community.controller";
import { reverse, search } from "../controllers/geo.controller";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { flagSchema } from "../validators/community.schemas";

const limiter = (limit: number, minutes: number, message: string) =>
  rateLimit({ windowMs: minutes * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { message } });

export const flagLimiter = limiter(30, 60, "You have reported a lot of content. Please try again later.");

export const feedRouter = Router();
feedRouter.get("/", authenticate, getFeed);

export const commentRouter = Router();
commentRouter.use(authenticate);
commentRouter.delete("/:id", deleteComment);
commentRouter.post("/:id/flag", flagLimiter, validateBody(flagSchema), flagComment);

export const geoRouter = Router();
geoRouter.use(authenticate, limiter(60, 1, "Too many address searches. Please slow down."));
geoRouter.get("/search", search);
geoRouter.get("/reverse", reverse);
