import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  changePassword,
  forgotPassword,
  resetPassword,
  login,
  logout,
  me,
  register,
  updateProfile,
  uploadAvatar,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { photo } from "../middleware/upload";
import { validateBody } from "../middleware/validate";
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema, updateProfileSchema } from "../validators/auth.schemas";

export const authRouter = Router();

const attemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password attempts. Please try again in a few minutes." },
});

// Few requests per person: each one sends an email.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many reset requests. Please try again in 15 minutes." },
});

authRouter.post("/register", attemptLimiter, validateBody(registerSchema), register);
authRouter.post("/login", attemptLimiter, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.post("/forgot", forgotLimiter, validateBody(forgotSchema), forgotPassword);
authRouter.post("/reset", passwordLimiter, validateBody(resetSchema), resetPassword);
authRouter.get("/me", authenticate, me);
authRouter.patch("/me", authenticate, validateBody(updateProfileSchema), updateProfile);
authRouter.post("/me/avatar", authenticate, photo("avatar"), uploadAvatar);
authRouter.patch("/me/password", authenticate, passwordLimiter, validateBody(changePasswordSchema), changePassword);
