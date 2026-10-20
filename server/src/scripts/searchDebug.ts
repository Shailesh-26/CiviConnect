import mongoose from "mongoose";
import { env } from "../config/env";
import { rankPhotos } from "../services/photoIndex";
import { splitByRelevance } from "../utils/searchRelevance";

// Shows how photo search scores every photo for some words, to check or tune the search.
//   npm run vision:search -- "garbage"
async function main() {
  const text = process.argv.slice(2).join(" ").trim();
  if (!text) {
    console.log('Usage: npm run vision:search -- "garbage"');
    return;
  }
  await mongoose.connect(env.MONGODB_URI);
  const found = await rankPhotos(text);
  if (!found) {
    console.log("The Photo Assistant is not running. Start it first.");
  } else {
    const { strong, looser } = splitByRelevance(found.ranked, (x) => x.s, 24, (x) => x.beats);
    const shown = new Set(strong);
    const loose = new Set(looser);
    console.log(`"${text}" against ${found.total} photos. Top 25:\n`);
    console.log("result   score  ticket       category      looks most like (score)");
    for (const x of found.ranked.slice(0, 25)) {
      const tag = shown.has(x) ? "MATCH  " : loose.has(x) ? "looser " : "-      ";
      const rival = x.rival ? `${x.rival.key} (${x.rival.score.toFixed(3)})` : "";
      console.log(`${tag}  ${x.s.toFixed(3)}  ${String(x.r.ticket ?? "").padEnd(11)}  ${String(x.r.category ?? "").padEnd(12)}  ${rival}`);
    }
    console.log(`\n${strong.length} matches, ${looser.length} looser.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
