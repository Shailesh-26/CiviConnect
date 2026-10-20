import type { RequestHandler } from "express";
import { User, type UserRole } from "../models/User";
import { AppError } from "../utils/AppError";
import { toPublicUser } from "../utils/publicUser";
import { COOKIE_NAME, verifyToken } from "../utils/token";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new AppError(401, "Please log in to continue");

  let session: { userId: string; issuedAt: number };
  try {
    session = verifyToken(token);
  } catch {
    throw new AppError(401, "Your session has expired. Please log in again");
  }

  const user = await User.findById(session.userId);
  if (!user || !user.isActive) throw new AppError(401, "Account not found or disabled");
  // A password change logs out every other device: sessions started before it no longer count.
  if (user.passwordChangedAt && session.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new AppError(401, "Your password was changed. Please log in again");
  }

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
