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
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: maxAgeSeconds });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Invalid token payload");
  }
  return payload.sub;
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: maxAgeSeconds * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}
