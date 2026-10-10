import { Schema, model } from "mongoose";

// Who did what, when. Written for every officer/admin action and for automatic escalations.
const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, enum: ["issue", "user", "comment", "category", "flag"], required: true },
    targetId: { type: String },
    summary: { type: String, required: true, maxlength: 300 },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: -1 });

export const AuditLog = model("AuditLog", auditSchema);
