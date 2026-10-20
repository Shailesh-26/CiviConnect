import { Schema, model } from "mongoose";

export const USER_ROLES = ["citizen", "officer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RADIUS_CHOICES = [1, 2, 5, 10] as const;

// Notification switches. Each role sees the ones that apply to it on the Profile page.
export const NOTIFY_KEYS = ["statusUpdates", "comments", "nearby", "assignments", "slaWarnings", "escalations"] as const;
export type NotifyKey = (typeof NOTIFY_KEYS)[number];

const avatarSchema = new Schema(
  {
    emoji: { type: String, maxlength: 16 },
    color: { type: String, maxlength: 9 },
    url: { type: String },
    publicId: { type: String },
  },
  { _id: false },
);

const notifyShape = Object.fromEntries(NOTIFY_KEYS.map((key) => [key, { type: Boolean, default: true }]));

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "citizen", index: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // Sessions that started before this moment are refused (see middleware/auth.ts).
    passwordChangedAt: { type: Date },
    // Last time this person did something (a click that changed data, or the app's "still here" ping).
    lastActiveAt: { type: Date },
    avatar: { type: avatarSchema, default: undefined },
    bio: { type: String, trim: true, maxlength: 160 },
    homeArea: { type: String, trim: true, maxlength: 80 },
    homeLocation: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: undefined,
    },
    radiusKm: { type: Number, enum: RADIUS_CHOICES, default: 2 },
    notify: { type: new Schema(notifyShape, { _id: false }), default: () => ({}) },
    // Issues this person chose to hide from their Neighbourhood feed.
    hiddenIssues: { type: [Schema.Types.ObjectId], default: [], select: false },
    // Officers on leave get no new work; their open issues were handed to colleagues.
    onLeaveSince: { type: Date },
    onLeaveUntil: { type: Date },
    // Why the officer is away. Seen by the officer and admins only, never by colleagues or citizens.
    onLeaveReason: { type: String, trim: true, maxlength: 200 },
    // Forgot-password: only a SHA-256 hash of the emailed token is stored, never the token itself.
    resetTokenHash: { type: String, select: false, index: true, sparse: true },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);
