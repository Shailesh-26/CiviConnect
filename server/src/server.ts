import { app } from "./app";
import { Comment } from "./models/Comment";
import { Flag } from "./models/Flag";
import { Notification } from "./models/Notification";
import { AuditLog } from "./models/AuditLog";
import { CategoryConfig } from "./models/CategoryConfig";
import { startScheduler } from "./services/scheduler";
import { loadSlaConfig } from "./services/sla";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { Issue } from "./models/Issue";

async function start() {
  await connectDB();
  // Make sure the geospatial index exists before the first report arrives.
  await Promise.all([Issue.init(), Comment.init(), Flag.init(), Notification.init(), AuditLog.init(), CategoryConfig.init()]);
  await loadSlaConfig();
  app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
    // The SLA sweep: warnings, escalations and unassigned alerts, once a minute.
    startScheduler();
    console.log("SLA sweep scheduled every minute");
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
