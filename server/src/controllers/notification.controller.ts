import type { RequestHandler } from "express";
import { isValidObjectId, Types } from "mongoose";
import { Notification } from "../models/Notification";
import { addStream, toNotificationDTO } from "../services/notify";

export const listNotifications: RequestHandler = async (req, res) => {
  const user = new Types.ObjectId(req.user!.id);
  const [items, unread] = await Promise.all([
    Notification.find({ user }).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ user, read: false }),
  ]);
  res.json({ unread, items: items.map(toNotificationDTO) });
};

export const markRead: RequestHandler = async (req, res) => {
  const id = String(req.params.id);
  if (isValidObjectId(id)) await Notification.updateOne({ _id: id, user: req.user!.id }, { read: true });
  res.json({ ok: true });
};

export const markAllRead: RequestHandler = async (req, res) => {
  await Notification.updateMany({ user: req.user!.id, read: false }, { read: true });
  res.json({ ok: true });
};

/**
 * Live stream (Server-Sent Events). The browser keeps this request open and receives
 * `notification` and `refresh` events the moment they happen. It reconnects by itself.
 */
export const stream: RequestHandler = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 5000\n\n");
  res.write(`event: hello\ndata: ${JSON.stringify({ at: new Date() })}\n\n`);

  const remove = addStream(req.user!.id, res);
  // A comment line every 25 s keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
};
