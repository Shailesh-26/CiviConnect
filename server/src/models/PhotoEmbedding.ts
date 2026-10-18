import { Schema, model } from "mongoose";

/**
 * One stored photo as a CLIP embedding (a list of about 512 numbers). Similar photos have similar lists.
 * Used for three things: the same-photo duplicate check, the AI fix check, and searching photos by words.
 */
const photoEmbeddingSchema = new Schema(
  {
    issue: { type: Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    ticket: { type: String, required: true },
    category: { type: String, required: true },
    // "report": a citizen's photo of the problem. "proof": the officer's photo of the fix.
    kind: { type: String, enum: ["report", "proof"], required: true },
    url: { type: String, required: true },
    vector: { type: [Number], required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
  },
  { timestamps: true },
);

photoEmbeddingSchema.index({ location: "2dsphere" });
photoEmbeddingSchema.index({ url: 1 }, { unique: true });

export const PhotoEmbedding = model("PhotoEmbedding", photoEmbeddingSchema);
