import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, register } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { loginSchema, registerSchema } from "../validators/auth.schemas";

export const authRouter = Router();

const attemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

authRouter.post("/register", attemptLimiter, validateBody(registerSchema), register);
authRouter.post("/login", attemptLimiter, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
