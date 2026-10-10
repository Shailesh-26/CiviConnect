import { z } from "zod";
import { USER_ROLES } from "../models/User";

export const updateUserSchema = z
  .object({
    isActive: z.boolean(),
    role: z.enum(USER_ROLES),
    department: z.string().trim().max(80, "Department must be at most 80 characters"),
  })
  .partial();

export const moderationSchema = z.object({
  targetType: z.enum(["issue", "comment"]),
  targetId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
  action: z.enum(["dismiss", "remove"]),
});

export const categorySchema = z.object({
  slaHours: z.coerce.number().int("Whole hours only").min(1, "At least 1 hour").max(1440, "At most 60 days"),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ModerationInput = z.infer<typeof moderationSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
