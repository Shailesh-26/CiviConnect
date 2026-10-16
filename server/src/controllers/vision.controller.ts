import type { RequestHandler } from "express";
import { CATEGORIES, Issue } from "../models/Issue";
import { classifyPhoto, visionHealth } from "../services/vision";
import { AppError } from "../utils/AppError";

// Is the Photo Assistant running, and which model is it using?
export const getVisionStatus: RequestHandler = async (_req, res) => {
  const health = await visionHealth();
  if (!health) {
    res.json({ available: false });
    return;
  }
  res.json({ available: true, model: health.model, loadSeconds: health.loadSeconds });
};

// Suggest a category for one photo. Nothing is stored here; the wizard sends the suggestion with the report.
export const classifyVision: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError(400, "Attach a photo");
  const result = await classifyPhoto(file);
  if (!result) throw new AppError(503, "The Photo Assistant is offline");
  res.json(result);
};

type AgreementRow = { _id: { category: string; verdict: string; mode: string | null }; n: number; agreed: number; avgConfidence: number | null };

// How often the Photo Assistant's top suggestion matched what people actually reported.
export const getVisionStats: RequestHandler = async (_req, res) => {
  const rows = (await Issue.aggregate([
    { $unwind: "$reports" },
    { $match: { "reports.ai.verdict": { $exists: true } } },
    {
      $group: {
        _id: { category: "$category", verdict: "$reports.ai.verdict", mode: "$reports.ai.mode" },
        n: { $sum: 1 },
        agreed: { $sum: { $cond: [{ $eq: ["$reports.ai.category", "$category"] }, 1, 0] } },
        avgConfidence: { $avg: "$reports.ai.confidence" },
      },
    },
  ])) as AgreementRow[];

  const sum = (pick: (r: AgreementRow) => boolean) => {
    const sel = rows.filter(pick);
    const n = sel.reduce((s, r) => s + r.n, 0);
    const agreed = sel.reduce((s, r) => s + r.agreed, 0);
    return { n, agreed, rate: n ? Math.round((agreed / n) * 1000) / 10 : null };
  };

  res.json({
    total: rows.reduce((s, r) => s + r.n, 0),
    civic: sum((r) => r._id.verdict !== "not_civic"),
    confident: sum((r) => r._id.verdict === "confident"),
    unsure: sum((r) => r._id.verdict === "unsure"),
    notCivic: rows.filter((r) => r._id.verdict === "not_civic").reduce((s, r) => s + r.n, 0),
    byMode: {
      "zero-shot": sum((r) => r._id.mode === "zero-shot" && r._id.verdict !== "not_civic"),
      trained: sum((r) => r._id.mode === "trained" && r._id.verdict !== "not_civic"),
    },
    byCategory: CATEGORIES.map((category) => ({ category, ...sum((r) => r._id.category === category && r._id.verdict !== "not_civic") })),
  });
};
