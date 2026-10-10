import { z } from "zod";
import { FLAG_REASONS } from "../models/Flag";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(1000, "Keep it under 1000 characters"),
  parentId: z.preprocess((v) => (v === "" ? undefined : v), objectId.optional()),
});

export const flagSchema = z.object({
  reason: z.enum(FLAG_REASONS, { error: "Choose a reason" }),
  note: z.string().trim().max(300, "Keep the note under 300 characters").optional(),
});

export type CommentInput = z.infer<typeof commentSchema>;
export type FlagInput = z.infer<typeof flagSchema>;
