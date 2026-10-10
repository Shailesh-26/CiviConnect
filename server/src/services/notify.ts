import type { Response } from "express";
import { Types } from "mongoose";
import { Notification, type NotificationType } from "../models/Notification";
import { User, type NotifyKey } from "../models/User";

// Live connections: user id -> open Server-Sent Events streams (one per open tab).
const streams = new Map<string, Set<Response>>();

export function addStream(userId: string, res: Response) {
  const set = streams.get(userId) ?? new Set<Response>();
  set.add(res);
  streams.set(userId, set);
  return () => {
    set.delete(res);
    if (set.size === 0) streams.delete(userId);
  };
}

export const onlineCount = () => streams.size;

function push(userId: string, event: string, data: unknown) {
  const set = streams.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}

// Which preference switch controls each kind of message.
const PREF: Record<NotificationType, NotifyKey | null> = {
  status: "statusUpdates",
  resolved: "statusUpdates",
  merged: "statusUpdates",
  comment: "comments",
  assigned: "assignments",
  unassigned: "assignments",
  new_issue: "assignments",
  sla_warning: "slaWarnings",
  escalated: "escalations",
  reopened: "escalations",
  flag: "escalations",
};

export type NotifyPayload = {
  type: NotificationType;
  title: string;
  body?: string;
  issueId?: string;
  link?: string;
  category?: string;
};

type IdLike = string | Types.ObjectId | { toString(): string };

/**
 * Save a notification for each user (respecting their switches) and push it live to open tabs.
 * `except` is usually the person who caused the event, so nobody is told about their own action.
 */
export async function notify(userIds: IdLike[], payload: NotifyPayload, except?: string) {
  try {
    const ids = [...new Set(userIds.map((u) => u.toString()))].filter((id) => id !== except && Types.ObjectId.isValid(id));
    if (ids.length === 0) return;
    const key = PREF[payload.type];
    const users = await User.find({ _id: { $in: ids }, isActive: true }).select("notify").lean();
    const wanted = users.filter((u) => !key || (u.notify as Record<string, boolean> | undefined)?.[key] !== false);
    if (wanted.length === 0) return;

    const docs = await Notification.insertMany(
      wanted.map((u) => ({
        user: u._id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link ?? (payload.issueId ? `/issues/${payload.issueId}` : undefined),
        issue: payload.issueId,
        category: payload.category,
      })),
    );
    for (const doc of docs) push(doc.user.toString(), "notification", toNotificationDTO(doc));
  } catch (err) {
    console.warn("Notification failed:", (err as Error).message);
  }
}

// A light "something changed" ping for live screens (Command Center, Field Desk).
export function broadcast(userIds: IdLike[], event: string, data: unknown) {
  for (const id of new Set(userIds.map((u) => u.toString()))) push(id, event, data);
}

export async function adminIds() {
  return (await User.find({ role: "admin", isActive: true }).select("_id").lean()).map((u) => u._id.toString());
}

export function toNotificationDTO(n: {
  _id: { toString(): string };
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  category?: string | null;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    category: n.category ?? null,
    read: n.read,
    createdAt: n.createdAt,
  };
}
