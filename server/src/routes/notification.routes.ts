import { Router } from "express";
import { listNotifications, markAllRead, markRead, stream } from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth";

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get("/", listNotifications);
notificationRouter.get("/stream", stream);
notificationRouter.post("/read-all", markAllRead);
notificationRouter.post("/:id/read", markRead);
