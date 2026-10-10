import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getOverview } from "../controllers/public.controller";

export const publicRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

publicRouter.get("/overview", limiter, getOverview);
