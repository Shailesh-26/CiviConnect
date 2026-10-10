import type { RequestHandler } from "express";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { hashPassword } from "../utils/password";
import { toAdminUser } from "../utils/publicUser";
import type { CreateOfficerInput } from "../validators/auth.schemas";

export const listUsers: RequestHandler = async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  res.json({ users: users.map((user) => toAdminUser(user)) });
};

export const createOfficer: RequestHandler = async (req, res) => {
  const { name, email, password, department } = req.body as CreateOfficerInput;

  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists");
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: "officer",
    department,
  });

  res.status(201).json({ user: toAdminUser(user) });
};
