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

export const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
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

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);
