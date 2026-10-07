import { Schema, model } from "mongoose";

export const CATEGORIES = ["pothole", "garbage", "drainage", "streetlight", "fallen_tree", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ["reported", "acknowledged", "in_progress", "resolved", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const OPEN_STATUSES: Status[] = ["reported", "acknowledged", "in_progress"];

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

// One citizen submission. Several reports of the same problem live inside one master issue.
const reportSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  images: { type: [imageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const timelineSchema = new Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byName: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const issueSchema = new Schema(
  {
    ticket: { type: String, required: true, unique: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
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
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

issueSchema.index({ location: "2dsphere" });

export const Issue = model("Issue", issueSchema);
