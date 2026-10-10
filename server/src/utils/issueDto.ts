import type { Category, Channel, Source, Status } from "../models/Issue";
import { computePriority, priorityLabel } from "./priority";

type Id = { toString(): string };

export type IssueRecord = {
  _id: Id;
  ticket: string;
  category: Category;
  customLabel?: string | null;
  customIcon?: string | null;
  source?: Source | null;
  address?: string | null;
  location: { coordinates: number[] };
  status: Status;
  reports: {
    description: string;
    images: { url: string }[];
    source?: Source | null;
    onBehalf?: { channel?: Channel | null } | null;
    createdAt: Date;
  }[];
  supporters: Id[];
  assignedTo?: { _id: Id; name: string; department?: string | null } | null;
  timeline: {
    status: Status;
    note?: string | null;
    images?: { url: string }[];
    byName?: string | null;
    at: Date;
  }[];
  verifications?: { user: Id; fixed: boolean }[];
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toIssueDTO(issue: IssueRecord, viewerId?: string) {
  const [lng, lat] = issue.location.coordinates;
  const priority = computePriority({
    category: issue.category,
    reportCount: issue.reports.length,
    supporterCount: issue.supporters.length,
    createdAt: issue.createdAt,
  });

  return {
    id: issue._id.toString(),
    ticket: issue.ticket,
    category: issue.category,
    customLabel: issue.category === "other" ? (issue.customLabel ?? null) : null,
    customIcon: issue.category === "other" ? (issue.customIcon ?? null) : null,
    source: issue.source ?? "citizen",
    address: issue.address ?? null,
    location: { lat, lng },
    status: issue.status,
    priority,
    priorityLabel: priorityLabel(priority),
    reportCount: issue.reports.length,
    supporterCount: issue.supporters.length,
    supportedByMe: viewerId ? issue.supporters.some((s) => s.toString() === viewerId) : false,
    assignedTo: issue.assignedTo
      ? {
          id: issue.assignedTo._id.toString(),
          name: issue.assignedTo.name,
          department: issue.assignedTo.department ?? null,
        }
      : null,
    description: issue.reports[0]?.description ?? "",
    images: issue.reports.flatMap((r) => r.images.map((img) => ({ url: img.url }))).slice(0, 6),
    resolvedAt: issue.resolvedAt ?? null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

// Reporter identities are never exposed (not even the name given for an on-behalf complaint),
// only what each report said and how it reached the city.
export function toIssueDetailDTO(issue: IssueRecord, viewerId?: string) {
  const votes = issue.verifications ?? [];
  const mine = viewerId ? votes.find((v) => v.user.toString() === viewerId) : undefined;

  return {
    ...toIssueDTO(issue, viewerId),
    reports: issue.reports.map((r) => ({
      description: r.description,
      images: r.images.map((img) => ({ url: img.url })),
      source: r.source ?? "citizen",
      channel: r.onBehalf?.channel ?? null,
      createdAt: r.createdAt,
    })),
    timeline: issue.timeline.map((t) => ({
      status: t.status,
      note: t.note ?? null,
      images: (t.images ?? []).map((img) => ({ url: img.url })),
      byName: t.byName ?? null,
      at: t.at,
    })),
    verification: {
      fixed: votes.filter((v) => v.fixed).length,
      notFixed: votes.filter((v) => !v.fixed).length,
      myVote: mine ? mine.fixed : null,
    },
  };
}
