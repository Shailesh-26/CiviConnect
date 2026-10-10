export type Role = "citizen" | "officer" | "admin";

export type NotifyKey = "statusUpdates" | "comments" | "nearby" | "assignments" | "slaWarnings" | "escalations";

export type Avatar = { emoji: string | null; color: string | null; url: string | null };

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  avatar: Avatar | null;
  bio: string | null;
  homeArea: string | null;
  // Only present for the signed-in user's own account.
  homeLocation?: { lat: number; lng: number } | null;
  radiusKm: number;
  notify?: Record<NotifyKey, boolean>;
  createdAt: string;
};

export type Category = "pothole" | "garbage" | "drainage" | "streetlight" | "fallen_tree" | "other";
export type Status = "reported" | "acknowledged" | "in_progress" | "resolved" | "rejected";
export type PriorityLabel = "low" | "medium" | "high";
export type Source = "citizen" | "field_inspection" | "on_behalf";
export type Channel = "phone" | "walk_in" | "email" | "letter";

export type Issue = {
  id: string;
  ticket: string;
  category: Category;
  customLabel: string | null;
  customIcon: string | null;
  source: Source;
  address: string | null;
  location: { lat: number; lng: number };
  status: Status;
  priority: number;
  priorityLabel: PriorityLabel;
  reportCount: number;
  supporterCount: number;
  supportedByMe: boolean;
  assignedTo: { id: string; name: string; department: string | null } | null;
  description: string;
  images: { url: string }[];
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssueDetail = Issue & {
  reports: {
    description: string;
    images: { url: string }[];
    source: Source;
    channel: Channel | null;
    createdAt: string;
  }[];
  timeline: {
    status: Status;
    note: string | null;
    images: { url: string }[];
    byName: string | null;
    at: string;
  }[];
  verification: { fixed: number; notFixed: number; myVote: boolean | null };
};

export type PublicOverview = {
  stats: {
    total: number;
    open: number;
    resolved: number;
    reports: number;
    avgResolutionHours: number | null;
    byCategory: { category: Category; count: number }[];
  };
  pins: {
    id: string;
    ticket: string;
    category: Category;
    customLabel?: string | null;
    customIcon?: string | null;
    status: Status;
    reportCount: number;
    location: { lat: number; lng: number };
  }[];
  activity: {
    ticket: string;
    category: Category;
    customLabel?: string | null;
    customIcon?: string | null;
    address?: string;
    status: Status;
    at: string;
  }[];
};
