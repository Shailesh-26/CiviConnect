import type { Types } from "mongoose";
import { Issue, OPEN_STATUSES, type Category } from "../models/Issue";
import { PhotoEmbedding } from "../models/PhotoEmbedding";
import { fixVerdict, type FixVerdict } from "../utils/fixCheck";
import { metres } from "../utils/geo";
import { splitByRelevance } from "../utils/searchRelevance";
import { cosine, round } from "../utils/vectors";
import { classifyPhoto, embedPhoto, embedText } from "./vision";

// Near-duplicate photo of the same spot (within 500 m), and the same photo uploaded again (anywhere).
export const NEAR_SAME_MIN = 0.88;
export const EXACT_SAME_MIN = 0.97;
const NEAR_RADIUS_M = 500;

type IssueLite = { _id: Types.ObjectId | { toString(): string }; ticket: string; category: Category | string; location?: { coordinates: number[] } | null };

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= 8 * 1024 * 1024 ? buf : null;
  } catch {
    return null;
  }
}

/** Store one photo's embedding (once per URL). Returns the vector, or null if it could not be made. */
export async function indexPhoto(issue: IssueLite, kind: "report" | "proof", url: string, source: { buffer?: Buffer; vector?: number[] } = {}) {
  if (!/^https?:\/\//.test(url) || !issue.location?.coordinates?.length) return null; // bundled demo pictures are not real photos
  const existing = await PhotoEmbedding.findOne({ url }).select("vector").lean();
  if (existing) return existing.vector as number[];
  const bytes = source.vector ? null : (source.buffer ?? (await fetchBytes(url)));
  const vector = source.vector ?? (bytes ? await embedPhoto(bytes) : null);
  if (!vector) return null;
  await PhotoEmbedding.create({
    issue: String(issue._id),
    ticket: issue.ticket,
    category: issue.category,
    kind,
    url,
    vector,
    location: { type: "Point", coordinates: issue.location.coordinates },
  }).catch(() => null); // a parallel request may have stored it already
  return vector;
}

// Embeddings of every citizen photo on an issue, making any that are missing.
async function reportVectors(issue: IssueLite & { reports: { images: { url: string }[] }[] }) {
  const urls = issue.reports.flatMap((r) => r.images.map((i) => i.url));
  const out: number[][] = [];
  for (const url of urls) {
    const v = await indexPhoto(issue, "report", url);
    if (v) out.push(v);
  }
  return out;
}

export type FixCheck = { verdict: FixVerdict; similarity: number | null; stillScore: number; comparedWith: number; mode: string; at: Date };

/** The AI fix check for a proof photo. Null when the Photo Assistant is not running. */
export async function runFixCheck(issue: IssueLite & { reports: { images: { url: string }[] }[] }, proof: Buffer, proofUrl: string | null): Promise<FixCheck | null> {
  const result = await classifyPhoto({ buffer: proof, mimetype: "image/jpeg", originalname: "proof.jpg" }, true);
  if (!result?.vector) return null;
  const before = await reportVectors(issue);
  const similarity = before.length ? Math.max(...before.map((v) => cosine(v, result.vector!))) : null;
  const top = result.top[0] ?? null;
  const verdict = fixVerdict({ issueCategory: issue.category as Category, similarity, proofTop: top, proofCivic: result.civic });
  if (proofUrl) await indexPhoto(issue, "proof", proofUrl, { vector: result.vector });
  return {
    verdict,
    similarity: similarity === null ? null : round(similarity),
    stillScore: top && top.category === issue.category ? round(top.score) : 0,
    comparedWith: before.length,
    mode: result.model.mode,
    at: new Date(),
  };
}

type IssueCard = { id: string; ticket: string; category: string; customLabel: string | null; status: string; address: string | null };

async function issueCards(ids: string[]) {
  const docs = await Issue.find({ _id: { $in: ids } }).select("ticket category customLabel status address location").lean();
  return new Map(
    docs.map((d) => [
      String(d._id),
      { card: { id: String(d._id), ticket: d.ticket, category: d.category, customLabel: d.customLabel ?? null, status: d.status, address: d.address ?? null } as IssueCard, location: d.location },
    ]),
  );
}

/** Report photos that look like this one: the same spot nearby, or the very same picture anywhere. */
export async function similarPhotos(vector: number[], point: { lat: number; lng: number } | null) {
  const best = new Map<string, { similarity: number; url: string; exact: boolean }>();
  const consider = (rows: { issue: unknown; url: string; vector: number[] }[], min: number, exact: boolean) => {
    for (const r of rows) {
      const s = cosine(vector, r.vector);
      const key = String(r.issue);
      if (s >= min && (!best.has(key) || best.get(key)!.similarity < s)) best.set(key, { similarity: s, url: r.url, exact: exact || s >= EXACT_SAME_MIN });
    }
  };
  if (point) {
    const near = await PhotoEmbedding.find({ kind: "report", location: { $near: { $geometry: { type: "Point", coordinates: [point.lng, point.lat] }, $maxDistance: NEAR_RADIUS_M } } })
      .select("issue url vector")
      .limit(300)
      .lean();
    consider(near as never, NEAR_SAME_MIN, false);
  }
  const recent = await PhotoEmbedding.find({ kind: "report" }).sort({ createdAt: -1 }).select("issue url vector").limit(3000).lean();
  consider(recent as never, EXACT_SAME_MIN, true);

  const cards = await issueCards([...best.keys()]);
  return [...best.entries()]
    .map(([id, m]) => {
      const info = cards.get(id);
      if (!info) return null;
      const [lng, lat] = info.location?.coordinates ?? [0, 0];
      return {
        ...info.card,
        photoUrl: m.url,
        similarity: round(m.similarity),
        exactSamePhoto: m.exact,
        distanceM: point ? Math.round(metres(point, { lat, lng })) : null,
        open: OPEN_STATUSES.includes(info.card.status as never),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

/** Search every stored photo with words. Ranked by how well each photo matches the sentence. */
export async function searchPhotos(text: string, limit = 24, kind?: "report" | "proof") {
  const query = await embedText(text);
  if (!query) return null;
  const rows = await PhotoEmbedding.find(kind ? { kind } : {}).sort({ createdAt: -1 }).select("issue url vector kind createdAt").limit(5000).lean();
  const ranked = rows.map((r) => ({ r, s: cosine(query, r.vector as number[]) })).sort((a, b) => b.s - a.s);
  // Only photos close to the best match count as real matches; the next few are offered as "looser" ones.
  const { strong, looser } = splitByRelevance(ranked, (x) => x.s, limit);
  const cards = await issueCards([...new Set([...strong, ...looser].map((x) => String(x.r.issue)))]);
  const toCard = ({ r, s }: (typeof ranked)[number]) => {
    const info = cards.get(String(r.issue));
    return info ? { ...info.card, photoUrl: r.url, kind: r.kind, score: round(s), at: r.createdAt } : null;
  };
  const notNull = <T,>(x: T | null): x is T => x !== null;
  return { total: rows.length, results: strong.map(toCard).filter(notNull), looser: looser.map(toCard).filter(notNull) };
}
