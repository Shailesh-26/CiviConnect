import type { RequestHandler } from "express";
import { CATEGORIES, Issue } from "../models/Issue";
import { classifyPhoto, visionHealth } from "../services/vision";
import { AppError } from "../utils/AppError";
import { isValidObjectId } from "mongoose";
import { audit } from "../services/audit";
import { searchPhotos, similarPhotos } from "../services/photoIndex";
import { issueName } from "../utils/labels";
import { parseVector } from "../utils/vectors";

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
  const result = await classifyPhoto(file, req.query.vector === "true");
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

// ---------------------------------------------------------------- Photo embeddings

// Same-photo duplicate check while reporting: the wizard sends the photo's vector and the chosen spot.
export const similarToPhoto: RequestHandler = async (req, res) => {
  const body = req.body as { vector?: unknown; lat?: unknown; lng?: unknown };
  const vector = parseVector(body.vector);
  if (!vector) throw new AppError(400, "Missing photo vector");
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const point = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  res.json({ matches: await similarPhotos(vector, point) });
};

// Search all stored photos by a sentence ("flooded road at night"). Officers and admins.
export const searchByWords: RequestHandler = async (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 200);
  if (q.length < 2) throw new AppError(400, "Type at least two letters");
  const kind = req.query.kind === "report" || req.query.kind === "proof" ? req.query.kind : undefined;
  const found = await searchPhotos(q, 24, kind);
  if (!found) throw new AppError(503, "The Photo Assistant is offline");
  res.json({ query: q, ...found });
};

// Fixes the AI fix check was unsure about, newest first.
export const listFixFlags: RequestHandler = async (_req, res) => {
  const issues = await Issue.find({ "fixCheck.verdict": { $in: ["different_place", "still_visible"] }, "fixCheck.reviewedAt": null })
    .sort({ "fixCheck.at": -1 })
    .limit(50)
    .populate("assignedTo", "name")
    .lean();
  res.json({
    items: issues.map((i) => {
      const proof = [...i.timeline].reverse().find((t) => t.status === "resolved" && (t.images?.length ?? 0) > 0);
      return {
        id: String(i._id),
        ticket: i.ticket,
        category: i.category,
        customLabel: i.customLabel ?? null,
        status: i.status,
        address: i.address ?? null,
        officer: (i.assignedTo as { name?: string } | null)?.name ?? null,
        before: i.reports.flatMap((r) => r.images)[0]?.url ?? null,
        after: proof?.images?.[0]?.url ?? null,
        fixCheck: i.fixCheck,
      };
    }),
  });
};

// An admin looked at a flagged fix and is happy with it (or reopened the issue).
export const reviewFixFlag: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) throw new AppError(404, "Issue not found");
  const issue = await Issue.findById(id);
  if (!issue?.fixCheck?.verdict) throw new AppError(404, "Nothing to review");
  issue.set("fixCheck.reviewedAt", new Date());
  await issue.save();
  await audit(req.user!, "issue.fix_reviewed", { type: "issue", id }, `${issueName(issue)}: flagged fix reviewed and accepted`);
  res.json({ ok: true });
};
