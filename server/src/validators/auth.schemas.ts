import { z } from "zod";

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateOfficerInput = z.infer<typeof createOfficerSchema>;
