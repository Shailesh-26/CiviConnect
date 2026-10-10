import { Schema, model } from "mongoose";

export const NOTIFICATION_TYPES = [
  "status",
  "resolved",
  "comment",
  "merged",
  "assigned",
  "sla_warning",
  "escalated",
  "reopened",
  "new_issue",
  "unassigned",
  "flag",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// One message in someone's bell. Kept small: title, one line of text, and where to go.
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, maxlength: 300 },
    link: { type: String, maxlength: 200 },
    issue: { type: Schema.Types.ObjectId, ref: "Issue" },
    category: { type: String },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 });
// Old notifications clean themselves up after 60 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

export const Notification = model("Notification", notificationSchema);
