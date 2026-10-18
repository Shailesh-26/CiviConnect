import { Schema, model } from "mongoose";

export const CATEGORIES = ["pothole", "garbage", "drainage", "streetlight", "fallen_tree", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["reported", "acknowledged", "in_progress", "resolved", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const OPEN_STATUSES: Status[] = ["reported", "acknowledged", "in_progress"];

// Who filed a report: a citizen, an officer during a field inspection, or an admin for a citizen.
export const SOURCES = ["citizen", "field_inspection", "on_behalf"] as const;
export type Source = (typeof SOURCES)[number];

// How a citizen reached the office when an admin files the complaint for them.
export const CHANNELS = ["phone", "walk_in", "email", "letter"] as const;
export type Channel = (typeof CHANNELS)[number];

// Emergencies: dangerous right now. 4-hour fix-by clock, +25 priority, admins alerted instantly.
export const EMERGENCY_KINDS = ["live_wire", "open_manhole", "road_blocked", "flooding", "other_danger"] as const;
export type EmergencyKind = (typeof EMERGENCY_KINDS)[number];

// Photo Assistant outcomes (see ml/app/main.py).
export const AI_VERDICTS = ["confident", "unsure", "not_civic"] as const;
export const AI_MODES = ["zero-shot", "trained"] as const;

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

// One submission. Several reports of the same problem live inside one master issue.
const reportSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  images: { type: [imageSchema], default: [] },
  source: { type: String, enum: SOURCES, default: "citizen" },
  // Only for on-behalf complaints. The name stays on the server and is never sent to other users.
  onBehalf: {
    type: new Schema(
      {
        name: { type: String, trim: true, maxlength: 80 },
        channel: { type: String, enum: CHANNELS },
      },
      { _id: false },
    ),
    default: undefined,
  },
  // What the Photo Assistant suggested for this report's photo, kept to measure real-world accuracy.
  ai: {
    type: new Schema(
      {
        verdict: { type: String, enum: AI_VERDICTS },
        category: { type: String, enum: CATEGORIES },
        confidence: { type: Number, min: 0, max: 1 },
        mode: { type: String, enum: AI_MODES },
      },
      { _id: false },
    ),
    default: undefined,
  },
  createdAt: { type: Date, default: Date.now },
});

const timelineSchema = new Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    images: { type: [imageSchema], default: [] },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

// A citizen's answer to "was this really fixed?" after an officer resolves an issue.
const verificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fixed: { type: Boolean, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const issueSchema = new Schema(
  {
    ticket: { type: String, required: true, unique: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    // Only for category "other": the reporter's own name for the problem and the icon they chose.
    customLabel: { type: String, trim: true, maxlength: 40 },
    customLabelKey: { type: String, index: true },
    customIcon: { type: String },
    // Source of the first report (who opened the issue).
    source: { type: String, enum: SOURCES, default: "citizen", index: true },
    address: { type: String, trim: true, maxlength: 200 },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    status: { type: String, enum: STATUSES, default: "reported", index: true },
    reports: { type: [reportSchema], default: [] },
    supporters: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    timeline: { type: [timelineSchema], default: [] },
    verifications: { type: [verificationSchema], default: [] },
    resolvedAt: { type: Date },
    // Community layer (Phase 7): people who get updates, discussion size, moderation signal.
    followers: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    commentCount: { type: Number, default: 0 },
    flagCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date },
    // Service level (Phase 8): fix-by time and what the automatic sweep has already done.
    slaDueAt: { type: Date, index: true },
    slaWarnedAt: { type: Date },
    escalatedAt: { type: Date },
    emergency: { type: Boolean, default: false, index: true },
    emergencyKind: { type: String, enum: EMERGENCY_KINDS },
    emergencyAt: { type: Date },
    unassignedAlertAt: { type: Date },
    // Set when the issue was handed to a colleague because its officer went on leave.
    handedOverFrom: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    // AI fix check of the latest proof photo (advisory, see utils/fixCheck.ts).
    fixCheck: {
      type: new Schema(
        {
          verdict: { type: String, enum: ["looks_fixed", "different_place", "still_visible"] },
          similarity: { type: Number },
          stillScore: { type: Number },
          comparedWith: { type: Number },
          mode: { type: String },
          at: { type: Date },
          reviewedAt: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

issueSchema.index({ location: "2dsphere" });

export const Issue = model("Issue", issueSchema);
