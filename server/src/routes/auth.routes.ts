import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  changePassword,
  login,
  logout,
  me,
  register,
  updateProfile,
  uploadAvatar,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { validateBody } from "../middleware/validate";
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "../validators/auth.schemas";

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

authRouter.post("/register", attemptLimiter, validateBody(registerSchema), register);
authRouter.post("/login", attemptLimiter, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
authRouter.patch("/me", authenticate, validateBody(updateProfileSchema), updateProfile);
authRouter.post("/me/avatar", authenticate, upload.single("avatar"), uploadAvatar);
authRouter.patch("/me/password", authenticate, passwordLimiter, validateBody(changePasswordSchema), changePassword);
