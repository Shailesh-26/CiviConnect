import type { RequestHandler } from "express";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { deleteImage, imageStorageEnabled, uploadImage } from "../utils/cloudinary";
import { hashPassword, verifyPassword } from "../utils/password";
import { toPublicUser } from "../utils/publicUser";
import { clearAuthCookie, setAuthCookie, signToken } from "../utils/token";
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from "../validators/auth.schemas";

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
  await user.save();
  res.json({ message: "Password changed" });
};
