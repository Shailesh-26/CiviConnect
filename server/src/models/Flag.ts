import { Schema, model } from "mongoose";

export const FLAG_REASONS = ["spam", "duplicate", "fake", "abusive", "wrong_location", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

// A report to the admins that an issue or comment is wrong or abusive. Reviewed in the moderation queue.
const flagSchema = new Schema(
  {
    targetType: { type: String, enum: ["issue", "comment"], required: true },
    target: { type: Schema.Types.ObjectId, required: true },
    issue: { type: Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: FLAG_REASONS, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ["open", "dismissed", "actioned"], default: "open", index: true },
  },
  { timestamps: true },
);

flagSchema.index({ targetType: 1, target: 1, user: 1 }, { unique: true });

export const Flag = model("Flag", flagSchema);
