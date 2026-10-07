import { z } from "zod";
import { CATEGORIES, STATUSES } from "../models/Issue";

export const createIssueSchema = z.object({
  category: z.enum(CATEGORIES, { error: "Choose a category" }),
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters")
    .max(1000, "Description must be at most 1000 characters"),
  lat: z.coerce.number({ error: "Pick the location on the map" }).min(-90).max(90),
  lng: z.coerce.number({ error: "Pick the location on the map" }).min(-180).max(180),
  address: z.string().trim().max(200, "Landmark must be at most 200 characters").optional(),
});

export const assignSchema = z.object({
  officerId: z.string().regex(/^[a-f\d]{24}$/i, "Choose an officer"),
});

export const statusSchema = z.object({
  status: z.enum(STATUSES, { error: "Choose a status" }),
  note: z.string().trim().max(500, "Note must be at most 500 characters").optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type AssignInput = z.infer<typeof assignSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
