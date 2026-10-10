import { Schema, model } from "mongoose";

// A message in an issue's discussion thread. One level of replies (parent = a top-level comment).
const imageSchema = new Schema({ url: { type: String, required: true }, publicId: { type: String, required: true } }, { _id: false });

const commentSchema = new Schema(
  {
    issue: { type: Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parent: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    body: { type: String, trim: true, maxlength: 1000 },
    images: { type: [imageSchema], default: [] },
    // Written by an officer or admin: shown as an official update.
    official: { type: Boolean, default: false },
    // Users who flagged this comment. Three flags hide it until an admin reviews it.
    flaggedBy: { type: [Schema.Types.ObjectId], default: [] },
    hidden: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Comment = model("Comment", commentSchema);
