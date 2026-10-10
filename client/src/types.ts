export type Role = "citizen" | "officer" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  createdAt: string;
};

export type Category = "pothole" | "garbage" | "drainage" | "streetlight" | "fallen_tree" | "other";
export type Status = "reported" | "acknowledged" | "in_progress" | "resolved" | "rejected";
export type PriorityLabel = "low" | "medium" | "high";

export type Issue = {
  id: string;
  ticket: string;
  category: Category;
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
  reports: { description: string; images: { url: string }[]; createdAt: string }[];
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
    status: Status;
    reportCount: number;
    location: { lat: number; lng: number };
  }[];
  activity: { ticket: string; category: Category; address?: string; status: Status; at: string }[];
};
