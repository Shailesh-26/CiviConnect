import type { RequestHandler } from "express";
import { User, type UserRole } from "../models/User";
import { AppError } from "../utils/AppError";
import { toPublicUser } from "../utils/publicUser";
import { COOKIE_NAME, verifyToken } from "../utils/token";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new AppError(401, "Please log in to continue");

  let userId: string;
  try {
    userId = verifyToken(token);
  } catch {
    throw new AppError(401, "Your session has expired. Please log in again");
  }

  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new AppError(401, "Account not found or disabled");

  req.user = toPublicUser(user);
  next();
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, "You do not have permission to do this");
    }
    next();
  };
