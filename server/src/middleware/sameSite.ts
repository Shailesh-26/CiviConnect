import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

// Second guard against cross-site request forgery: a browser always says which site a form or script
// came from (the Origin header). A change request from any other site is refused.
export function sameSiteOnly(req: Request, res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next(); // not sent by a browser page (for example curl or the test scripts)
  const allowed = new Set([env.CLIENT_URL.replace(/\/+$/, ""), `${req.protocol}://${req.get("host")}`]);
  if (allowed.has(origin)) return next();
  res.status(403).json({ message: "This request came from another website, so it was blocked." });
}
