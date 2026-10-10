import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { reversePlace, searchPlaces } from "../utils/geocode";

const UNAVAILABLE = "Address search is not available right now. Tap the map instead.";

export const search: RequestHandler = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
  if (q.length < 3) {
    res.json({ results: [] });
    return;
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  try {
    res.json({ results: await searchPlaces(q, near) });
  } catch (err) {
    console.warn("Address search failed:", (err as Error).message);
    throw new AppError(502, UNAVAILABLE);
  }
};

export const reverse: RequestHandler = async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new AppError(400, "Invalid location");
  }
  try {
    res.json({ place: await reversePlace(lat, lng) });
  } catch (err) {
    console.warn("Reverse geocoding failed:", (err as Error).message);
    throw new AppError(502, UNAVAILABLE);
  }
};
