import { z } from "zod";
import { AI_MODES, AI_VERDICTS, CATEGORIES, CHANNELS, STATUSES } from "../models/Issue";
import { CUSTOM_ICON_KEYS } from "../utils/customIcons";

// Multipart form fields arrive as strings; empty strings mean "not given".
const optionalText = (max: number, message: string) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(max, message).optional());

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const blankOrInvalid = (allowed: readonly string[]) => (v: unknown) => (typeof v === "string" && allowed.includes(v) ? v : undefined);

export const createIssueSchema = z.object({
  category: z.enum(CATEGORIES, { error: "Choose a category" }),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters")
    .max(1000, "Description must be at most 1000 characters"),
  // An empty field must not silently become 0 (a point in the ocean), so blanks are treated as missing.
  lat: z.preprocess(blankToUndefined, z.coerce.number({ error: "Pick the location on the map" }).min(-90).max(90)),
  lng: z.preprocess(blankToUndefined, z.coerce.number({ error: "Pick the location on the map" }).min(-180).max(180)),
  address: optionalText(200, "Landmark must be at most 200 characters"),
  // Required only for category "other" (checked in the controller).
  customLabel: optionalText(40, "Keep the problem name under 40 characters"),
  customIcon: z.preprocess((v) => (v === "" ? undefined : v), z.enum(CUSTOM_ICON_KEYS, { error: "Pick an icon" }).optional()),
  // Required only when an admin files a complaint for a citizen.
  onBehalfName: optionalText(80, "Name must be at most 80 characters"),
  channel: z.preprocess((v) => (v === "" ? undefined : v), z.enum(CHANNELS, { error: "Choose how they contacted you" }).optional()),
  // What the Photo Assistant suggested, if it ran. Never required; bad values are simply ignored.
  aiVerdict: z.preprocess(blankOrInvalid(AI_VERDICTS), z.enum(AI_VERDICTS).optional()),
  aiCategory: z.preprocess(blankOrInvalid(CATEGORIES), z.enum(CATEGORIES).optional()),
  aiConfidence: z.preprocess((v) => {
    const n = Number(v);
    return v === "" || v == null || !Number.isFinite(n) || n < 0 || n > 1 ? undefined : n;
  }, z.number().optional()),
  aiMode: z.preprocess(blankOrInvalid(AI_MODES), z.enum(AI_MODES).optional()),
});

export const assignSchema = z.object({
  officerId: z.string().regex(/^[a-f\d]{24}$/i, "Choose an officer"),
});

export const statusSchema = z.object({
  status: z.enum(STATUSES, { error: "Choose a status" }),
  note: z.string().trim().max(500, "Note must be at most 500 characters").optional(),
});

export const verifySchema = z.object({
  fixed: z.boolean({ error: "Choose an option" }),
});

export type VerifyInput = z.infer<typeof verifySchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
