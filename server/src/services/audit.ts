import { AuditLog } from "../models/AuditLog";

type Actor = { id?: string; name: string; role: string };

// Never let a failed audit write break the action itself.
export async function audit(
  actor: Actor,
  action: string,
  target: { type: "issue" | "user" | "comment" | "category" | "flag"; id?: string },
  summary: string,
  meta?: Record<string, unknown>,
) {
  try {
    await AuditLog.create({
      actor: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      targetType: target.type,
      targetId: target.id,
      summary,
      meta,
    });
  } catch (err) {
    console.warn("Audit log write failed:", (err as Error).message);
  }
}

export const SYSTEM = { name: "CiviConnect", role: "system" } as const;
