import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getOverview, getPublicIssue } from "../controllers/public.controller";

export const publicRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

publicRouter.get("/overview", limiter, getOverview);
publicRouter.get("/issues/:ticket", limiter, getPublicIssue);
