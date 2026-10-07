import type { RequestHandler } from "express";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { hashPassword, verifyPassword } from "../utils/password";
import { toPublicUser } from "../utils/publicUser";
import { clearAuthCookie, setAuthCookie, signToken } from "../utils/token";
import type { LoginInput, RegisterInput } from "../validators/auth.schemas";

export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = req.body as RegisterInput;

  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists");
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: "citizen",
  });

  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user: toPublicUser(user) });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email }).select("+passwordHash");
  const passwordOk = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordOk || !user.isActive) {
    throw new AppError(401, "Incorrect email or password");
  }

  setAuthCookie(res, signToken(user.id));
  res.json({ user: toPublicUser(user) });
};

export const logout: RequestHandler = (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: req.user });
};
