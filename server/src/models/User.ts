import { Schema, model } from "mongoose";

export const USER_ROLES = ["citizen", "officer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "citizen", index: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = model("User", userSchema);
