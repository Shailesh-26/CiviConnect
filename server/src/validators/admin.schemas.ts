import { z } from "zod";
import { USER_ROLES } from "../models/User";

// Optional end date for leave (YYYY-MM-DD), today or later and at most 90 days ahead. Leave ends at the end of that day.
const leaveUntil = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"), z.null()])
  .transform((v) => (v ? new Date(`${v}T23:59:59`) : null))
  .refine((d) => d === null || (d.getTime() > Date.now() && d.getTime() < Date.now() + 91 * 86_400_000), "Pick a date within the next 90 days");

export const updateUserSchema = z
  .object({
    isActive: z.boolean(),
    role: z.enum(USER_ROLES),
    department: z.string().trim().max(80, "Department must be at most 80 characters"),
    onLeave: z.boolean(),
    leaveUntil: leaveUntil,
    leaveReason: z.string().trim().max(200, "Keep the reason under 200 characters"),
  })
  .partial()
  .refine((v) => v.onLeave !== true || (v.leaveReason ?? "").length >= 3, { message: "Say briefly why (at least 3 characters)", path: ["leaveReason"] });

export const leaveSchema = z
  .object({
    onLeave: z.boolean(),
    leaveUntil: leaveUntil.optional(),
    leaveReason: z.string().trim().max(200, "Keep the reason under 200 characters").optional(),
  })
  .refine((v) => !v.onLeave || (v.leaveReason ?? "").length >= 3, { message: "Say briefly why (at least 3 characters)", path: ["leaveReason"] });
export type LeaveInput = z.infer<typeof leaveSchema>;

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
