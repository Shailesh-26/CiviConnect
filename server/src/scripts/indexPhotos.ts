import mongoose from "mongoose";
import { env } from "../config/env";
import { Issue } from "../models/Issue";
import { PhotoEmbedding } from "../models/PhotoEmbedding";
import { indexPhoto } from "../services/photoIndex";
import { visionHealth } from "../services/vision";

/**
 * Makes embeddings for photos that were uploaded before Phase 12 (or while the Photo Assistant was off),
 * so they appear in photo search, duplicate checks and fix checks.
 * Run with the Photo Assistant running:  npm run vision:index
 */
async function main() {
  if (!(await visionHealth(true))) {
    console.error(`The Photo Assistant is not running at ${env.VISION_URL}. Start it first (see README, "Running every day").`);
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  const issues = await Issue.find({ $or: [{ "reports.images.0": { $exists: true } }, { "timeline.images.0": { $exists: true } }] })
    .select("ticket category location reports.images timeline.status timeline.images")
    .lean();
  let done = 0;
  let skipped = 0;
  for (const issue of issues) {
    const photos = [
      ...issue.reports.flatMap((r) => r.images.map((i) => ({ url: i.url, kind: "report" as const }))),
      ...issue.timeline.filter((t) => t.status === "resolved").flatMap((t) => (t.images ?? []).map((i) => ({ url: i.url, kind: "proof" as const }))),
    ];
    for (const p of photos) {
      const v = await indexPhoto(issue, p.kind, p.url);
      if (v) done++;
      else skipped++;
    }
    process.stdout.write(`\r${issue.ticket}: ${done} photos indexed, ${skipped} skipped`);
  }
  console.log(`\nDone. ${await PhotoEmbedding.countDocuments()} photos are searchable. Skipped photos are bundled demo pictures or could not be downloaded.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
