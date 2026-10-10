import { z } from "zod";
import { NOTIFY_KEYS, RADIUS_CHOICES } from "../models/User";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const name = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be at most 80 characters");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

export const registerSchema = z.object({ name, email, password });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const createOfficerSchema = z.object({
  name,
  email,
  password,
  department: z
    .string()
    .trim()
    .min(2, "Department is required")
    .max(80, "Department must be at most 80 characters"),
});

// Every field is optional: the Profile page sends only what changed.
export const updateProfileSchema = z
  .object({
    name,
    bio: z.string().trim().max(160, "Bio must be at most 160 characters"),
    homeArea: z.string().trim().max(80, "Home area must be at most 80 characters"),
    homeLocation: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .nullable(),
    radiusKm: z.union(RADIUS_CHOICES.map((r) => z.literal(r)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<5>, z.ZodLiteral<10>], {
      error: "Choose 1, 2, 5 or 10 km",
    }),
    notify: z.partialRecord(z.enum(NOTIFY_KEYS), z.boolean()),
    // A preset avatar (emoji on a colour), or null to go back to initials.
    avatar: z
      .object({
        emoji: z.string().min(1).max(16),
        color: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour"),
      })
      .nullable(),
  })
  .partial();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "The new password must be different from the current one",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOfficerInput = z.infer<typeof createOfficerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
