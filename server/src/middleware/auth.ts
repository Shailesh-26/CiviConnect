import type { RequestHandler } from "express";
import { User, type UserRole } from "../models/User";
import { AppError } from "../utils/AppError";
import { toPublicUser } from "../utils/publicUser";
import { env } from "../config/env";
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
  if (!user) throw new AppError(401, "Your account no longer exists. Please log in again");
  if (!user.isActive) throw new AppError(401, "An admin turned off your account. Contact the city office if this is a mistake");
  // A password change logs out every other device: sessions started before it no longer count.
  if (user.passwordChangedAt && session.issuedAt < user.passwordChangedAt.getTime()) {
    throw new AppError(401, "Your password was changed. Please log in again");
  }

  // Inactivity: the app logs out after SESSION_IDLE_MINUTES (plus a one-minute warning). The server
  // allows three minutes more, then refuses, so a laptop left open (or asleep) is safe too.
  const now = Date.now();
  const idleLimit = (env.SESSION_IDLE_MINUTES + 4) * 60_000;
  if (user.lastActiveAt && now - user.lastActiveAt.getTime() > idleLimit) {
    throw new AppError(401, `No activity for ${env.SESSION_IDLE_MINUTES} minutes`);
  }
  // Anything that changes data counts as activity (reading pages in the background does not).
  if (req.method !== "GET" && (!user.lastActiveAt || now - user.lastActiveAt.getTime() > 30_000)) {
    await User.updateOne({ _id: user._id }, { lastActiveAt: new Date(now) });
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
