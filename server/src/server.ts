import { app } from "./app";
import { Comment } from "./models/Comment";
import { Flag } from "./models/Flag";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { Issue } from "./models/Issue";

async function start() {
  await connectDB();
  // Make sure the geospatial index exists before the first report arrives.
  await Promise.all([Issue.init(), Comment.init(), Flag.init()]);
  app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
