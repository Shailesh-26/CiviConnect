import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env";
import { audit } from "../services/audit";
import { emailLayout, mailConfigured, sendMail } from "../services/mailer";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { deleteImage, imageStorageEnabled, uploadImage } from "../utils/cloudinary";
import { hashPassword, verifyPassword } from "../utils/password";
import { toPublicUser } from "../utils/publicUser";
import { clearAuthCookie, setAuthCookie, signToken } from "../utils/token";
import type { ChangePasswordInput, ForgotInput, LoginInput, RegisterInput, ResetInput, UpdateProfileInput } from "../validators/auth.schemas";

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

  if (!user || !passwordOk) {
    throw new AppError(401, "Incorrect email or password");
  }
  // Said only after the right password, so it never reveals which emails have accounts.
  if (!user.isActive) {
    throw new AppError(403, "This account has been deactivated. Please contact your city admin to turn it back on.");
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

async function loadSelf(id: string) {
  const user = await User.findById(id);
  if (!user || !user.isActive) throw new AppError(401, "Account not found or disabled");
  return user;
}

export const updateProfile: RequestHandler = async (req, res) => {
  const input = req.body as UpdateProfileInput;
  const user = await loadSelf(req.user!.id);

  if (input.name !== undefined) user.name = input.name;
  if (input.bio !== undefined) user.bio = input.bio || undefined;
  if (input.homeArea !== undefined) user.homeArea = input.homeArea || undefined;
  if (input.homeLocation !== undefined) user.set("homeLocation", input.homeLocation ?? undefined);
  if (input.radiusKm !== undefined) user.radiusKm = input.radiusKm;
  if (input.notify) {
    for (const [key, value] of Object.entries(input.notify)) user.set(`notify.${key}`, value);
  }
  if (input.avatar !== undefined) {
    const oldPhoto = user.avatar?.publicId;
    user.set("avatar", input.avatar ? { emoji: input.avatar.emoji, color: input.avatar.color } : undefined);
    await user.save();
    await deleteImage(oldPhoto);
  } else {
    await user.save();
  }

  res.json({ user: toPublicUser(user) });
};

export const uploadAvatar: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) throw new AppError(400, "Choose a photo to upload");
  if (!imageStorageEnabled) throw new AppError(503, "Photo upload is not set up on the server yet");

  const user = await loadSelf(req.user!.id);
  const oldPhoto = user.avatar?.publicId;
  const image = await uploadImage(file.buffer, "avatar");
  user.set("avatar", { url: image.url, publicId: image.publicId });
  await user.save();
  await deleteImage(oldPhoto);

  res.json({ user: toPublicUser(user) });
};

export const changePassword: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  const user = await User.findById(req.user!.id).select("+passwordHash");
  if (!user) throw new AppError(401, "Account not found or disabled");

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, "Your current password is not correct", {
      errors: [{ field: "currentPassword", message: "Your current password is not correct" }],
    });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  // Other devices are logged out; this one gets a fresh session so the person stays signed in here.
  setAuthCookie(res, signToken(user.id));
  res.json({ message: "Password changed" });
};

// ---------------------------------------------------------------- Forgot password

const RESET_MINUTES = 30;
const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/**
 * Emails a one-time reset link valid for 30 minutes. The answer is the same whether or not the email
 * exists, so nobody can use this form to find out who has an account.
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  const { email } = req.body as ForgotInput;
  const generic = { message: "If an account exists for that email, a reset link is on its way. It works for 30 minutes." };
  const user = await User.findOne({ email, isActive: true });
  if (!user) {
    res.json(generic);
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.set({ resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + RESET_MINUTES * 60_000) });
  await user.save();

  const link = `${env.CLIENT_URL.replace(/\/+$/, "")}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your CiviConnect password",
    text: `Hi ${user.name},\n\nOpen this link to choose a new password (valid for ${RESET_MINUTES} minutes):\n${link}\n\nIf you did not ask for this, ignore this email. Your password stays the same.`,
    html: emailLayout("Reset your password", [`Hi ${user.name},`, `Tap the button to choose a new password. The link works for ${RESET_MINUTES} minutes and only once.`, "If you did not ask for this, ignore this email. Your password stays the same."], { text: "Choose a new password", url: link }),
  });

  // On a laptop without email set up, hand the link straight to the page so the flow can be demonstrated.
  res.json(env.NODE_ENV !== "production" && !mailConfigured ? { ...generic, devLink: link } : generic);
};

export const resetPassword: RequestHandler = async (req, res) => {
  const { token, password } = req.body as ResetInput;
  const user = await User.findOne({ resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() }, isActive: true });
  if (!user) throw new AppError(400, "This reset link has expired or was already used. Ask for a new one.");

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.set({ resetTokenHash: undefined, resetTokenExpires: undefined });
  await user.save();
  await audit({ id: user.id, name: user.name, role: user.role }, "user.password_reset", { type: "user", id: user.id }, `${user.name} reset their password by email`);
  await sendMail({
    to: user.email,
    subject: "Your CiviConnect password was changed",
    text: `Hi ${user.name},\n\nYour password was just changed. If this was not you, reset it again right away and tell the city office.`,
    html: emailLayout("Password changed", [`Hi ${user.name},`, "Your password was just changed. If this was not you, reset it again right away and tell the city office."]),
  });

  // Signed in straight away: they just proved they own the email address.
  setAuthCookie(res, signToken(user.id));
  res.json({ user: toPublicUser(user) });
};
