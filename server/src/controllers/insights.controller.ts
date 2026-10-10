import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { areaReportCards, chronicSpots, civicScore, timeline } from "../services/insights";
import { simulatorStatus, startSimulator, stopSimulator } from "../services/simulator";
import { audit } from "../services/audit";

const daysOf = (q: unknown, allowed: number[], fallback: number) => (allowed.includes(Number(q)) ? Number(q) : fallback);

export const getChronic: RequestHandler = async (req, res) => {
  res.json({ spots: await chronicSpots(daysOf(req.query.days, [60, 90, 120, 180, 365], 120)) });
};

export const getAreas: RequestHandler = async (req, res) => {
  res.json({ days: daysOf(req.query.days, [30, 90, 180], 90), areas: await areaReportCards(daysOf(req.query.days, [30, 90, 180], 90)) });
};

export const getTimeline: RequestHandler = async (req, res) => {
  res.json({ items: await timeline(daysOf(req.query.days, [30, 90, 180], 90)) });
};

export const getMyCivic: RequestHandler = async (req, res) => {
  if (req.user!.role !== "citizen") throw new AppError(403, "Civic score is for citizen accounts");
  res.json(await civicScore(req.user!.id));
};

export const getSimulator: RequestHandler = (_req, res) => {
  res.json(simulatorStatus());
};

export const controlSimulator: RequestHandler = async (req, res) => {
  const { action, everySeconds } = req.body as { action?: string; everySeconds?: number };
  if (action === "start") {
    try {
      const status = await startSimulator(Number(everySeconds) || 8);
      await audit(req.user!, "simulator.started", { type: "category", id: "simulator" }, `Live demo simulator started (one action every ~${status.everySeconds} s)`);
      res.json(status);
    } catch (err) {
      throw new AppError(400, (err as Error).message);
    }
    return;
  }
  if (action === "stop") {
    const status = stopSimulator();
    await audit(req.user!, "simulator.stopped", { type: "category", id: "simulator" }, `Live demo simulator stopped after ${status.actions} actions`);
    res.json(status);
    return;
  }
  throw new AppError(400, "Use action start or stop");
};
