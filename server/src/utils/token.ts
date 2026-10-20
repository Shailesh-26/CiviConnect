import jwt from "jsonwebtoken";
import type { Response } from "express";
import { env } from "../config/env";

export const COOKIE_NAME = "civiconnect_token";

const maxAgeSeconds = env.JWT_EXPIRES_DAYS * 24 * 60 * 60;
const isProd = env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  path: "/",
};

export function signToken(userId: string) {
  // `at` is the sign-in moment in milliseconds: the standard `iat` only counts whole seconds, too coarse
  // to tell a session started just before a password change from the one started just after it.
  return jwt.sign({ sub: userId, at: Date.now() }, env.JWT_SECRET, { expiresIn: maxAgeSeconds });
}

export function verifyToken(token: string): { userId: string; issuedAt: number } {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Invalid token payload");
  }
  const at = typeof payload.at === "number" ? payload.at : (payload.iat ?? 0) * 1000;
  return { userId: payload.sub, issuedAt: at };
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: maxAgeSeconds * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}
