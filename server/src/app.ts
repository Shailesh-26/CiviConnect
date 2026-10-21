import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { adminRouter } from "./routes/admin.routes";
import { commentRouter, feedRouter, geoRouter } from "./routes/community.routes";
import { notificationRouter } from "./routes/notification.routes";
import { analyticsRouter, officerRouter } from "./routes/workspace.routes";
import { insightsRouter } from "./routes/insights.routes";
import { authRouter } from "./routes/auth.routes";
import { healthRouter } from "./routes/health";
import { issueRouter } from "./routes/issue.routes";
import { publicRouter } from "./routes/public.routes";
import { visionRouter } from "./routes/vision.routes";
import { sameSiteOnly } from "./middleware/sameSite";

export const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Map tiles come from OpenStreetMap and photos from Cloudinary; blob: is the photo preview before upload.
        "img-src": ["'self'", "data:", "blob:", "https://tile.openstreetmap.org", "https://res.cloudinary.com"],
        "connect-src": ["'self'"],
      },
    },
  }),
);
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(sameSiteOnly);
app.use(morgan("dev"));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/issues", issueRouter);
app.use("/api/public", publicRouter);
app.use("/api/feed", feedRouter);
app.use("/api/comments", commentRouter);
app.use("/api/geo", geoRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/officer", officerRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/vision", visionRouter);

// In production the same server also sends the built React app (client/dist), so the site and the API
// share one address. Any page that is not a file (for example /issues/123) gets index.html.
const clientDist = path.resolve(__dirname, "../../client/dist");
if (env.NODE_ENV === "production" && fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
  app.use("/assets", express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y" }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);
