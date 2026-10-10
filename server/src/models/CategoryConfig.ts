import { Schema, model } from "mongoose";
import { CATEGORIES } from "./Issue";

// Fix-by time (SLA) per category, editable by admins.
const categoryConfigSchema = new Schema(
  {
    category: { type: String, enum: CATEGORIES, required: true, unique: true },
    slaHours: { type: Number, required: true, min: 1, max: 24 * 60 },
  },
  { timestamps: true },
);

export const CategoryConfig = model("CategoryConfig", categoryConfigSchema);
