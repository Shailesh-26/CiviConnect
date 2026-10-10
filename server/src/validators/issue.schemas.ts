import { z } from "zod";
import { CATEGORIES, CHANNELS, STATUSES } from "../models/Issue";
import { CUSTOM_ICON_KEYS } from "../utils/customIcons";

// Multipart form fields arrive as strings; empty strings mean "not given".
const optionalText = (max: number, message: string) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(max, message).optional());

export const createIssueSchema = z.object({
  category: z.enum(CATEGORIES, { error: "Choose a category" }),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters")
    .max(1000, "Description must be at most 1000 characters"),
  lat: z.coerce.number({ error: "Pick the location on the map" }).min(-90).max(90),
  lng: z.coerce.number({ error: "Pick the location on the map" }).min(-180).max(180),
  address: optionalText(200, "Landmark must be at most 200 characters"),
  // Required only for category "other" (checked in the controller).
  customLabel: optionalText(40, "Keep the problem name under 40 characters"),
  customIcon: z.preprocess((v) => (v === "" ? undefined : v), z.enum(CUSTOM_ICON_KEYS, { error: "Pick an icon" }).optional()),
  // Required only when an admin files a complaint for a citizen.
  onBehalfName: optionalText(80, "Name must be at most 80 characters"),
  channel: z.preprocess((v) => (v === "" ? undefined : v), z.enum(CHANNELS, { error: "Choose how they contacted you" }).optional()),
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
