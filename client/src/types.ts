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
  followedByMe: boolean;
  commentCount: number;
  lastActivityAt: string;
  assignedTo: { id: string; name: string; department: string | null } | null;
  description: string;
  images: { url: string }[];
  resolvedAt: string | null;
  escalated: boolean;
  sla: Sla;
  createdAt: string;
  updatedAt: string;
};

export type SlaState = "ok" | "warning" | "breached" | "met" | "missed" | "none";
export type Sla = { dueAt: string; hours: number; hoursLeft: number; state: SlaState; escalated: boolean };

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

export type FeedSort = "hot" | "new" | "top" | "unresolved" | "resolved";

export type FeedItem = Issue & {
  distanceM: number;
  flaggedByMe: boolean;
  latestUpdate: { status: Status; note: string | null; at: string } | null;
};

export type FeedResponse = {
  center: { lat: number; lng: number };
  radiusKm: number;
  sort: FeedSort;
  total: number;
  page: number;
  hasMore: boolean;
  items: FeedItem[];
};

export type NearbyItem = Issue & { distanceM: number; confidence: number; willMerge: boolean };

export type FlagReason = "spam" | "duplicate" | "fake" | "abusive" | "wrong_location" | "other";

export type IssueComment = {
  id: string;
  parentId: string | null;
  body: string | null;
  images: { url: string }[];
  official: boolean;
  deleted: boolean;
  hidden: boolean;
  author: { name: string; role: Role; department: string | null; avatar: Avatar | null } | null;
  isMine: boolean;
  canDelete: boolean;
  flaggedByMe: boolean;
  createdAt: string;
};

export type PublicIssue = {
  ticket: string;
  category: Category;
  customLabel: string | null;
  customIcon: string | null;
  status: Status;
  address: string | null;
  location: { lat: number; lng: number };
  reportCount: number;
  supporterCount: number;
  commentCount: number;
  before: { url: string } | null;
  after: { url: string } | null;
  timeline: { status: Status; note: string | null; at: string }[];
  resolvedAt: string | null;
  createdAt: string;
};

export type Place = { label: string; full: string; lat: number; lng: number };

export type NotificationType =
  | "status" | "resolved" | "comment" | "merged" | "assigned" | "sla_warning" | "escalated" | "reopened" | "new_issue" | "unassigned" | "flag";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  category: Category | null;
  read: boolean;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  summary: string;
  targetType: string;
  targetId: string | null;
  at: string;
};

export type Suggestion = { id: string; name: string; reason: string } | null;

export type Lane = {
  officer: { id: string; name: string; department: string | null; avatar: Avatar | null };
  open: number;
  breached: number;
  resolved30d: number;
  avgFixHours: number | null;
  issues: Issue[];
};

export type CommandOverview = {
  kpis: { open: number; unassigned: number; breached: number; dueSoon: number; highPriority: number; resolved7d: number; flagsOpen: number };
  breachBoard: Issue[];
  unassigned: (Issue & { suggestion: Suggestion })[];
  lanes: Lane[];
  pins: {
    id: string;
    ticket: string;
    category: Category;
    customIcon: string | null;
    customLabel: string | null;
    status: Status;
    priorityLabel: PriorityLabel;
    slaState: SlaState;
    assigned: boolean;
    location: { lat: number; lng: number };
  }[];
  activity: AuditEntry[];
};

export type DeskData = {
  stats: {
    open: number;
    breached: number;
    dueToday: number;
    inProgress: number;
    resolvedWeek: number;
    resolved90d: number;
    avgFixHours: number | null;
    onTimeRate: number | null;
  };
  queue: Issue[];
  recent: Issue[];
};

export type AnalyticsData = {
  days: number;
  weekly: boolean;
  kpis: {
    reported: number;
    reportedPrev: number;
    resolved: number;
    resolvedPrev: number;
    openNow: number;
    breachedNow: number;
    avgFixHours: number | null;
    medianFixHours: number | null;
    slaCompliance: number | null;
    reopenRate: number | null;
    medianFirstResponseHours: number | null;
    citizensEngaged: number;
  };
  trend: { key: string; reported: number; resolved: number }[];
  statusShare: { status: Status; count: number }[];
  byCategory: { category: Category; reported: number; open: number; resolved: number; avgFixHours: number | null; slaCompliance: number | null }[];
  heat: { day: number; hour: number; count: number }[];
  areas: { area: string; total: number; counts: Partial<Record<Category, number>> }[];
  leaderboard: {
    id: string;
    name: string;
    department: string | null;
    active: boolean;
    resolved: number;
    open: number;
    breached: number;
    avgFixHours: number | null;
    onTimeRate: number | null;
    reopened: number;
  }[];
  hotspots: { id: string; lat: number; lng: number; category: Category; priority: number }[];
};

export type AdminUser = User & { isActive: boolean; reportCount: number };

export type FlagGroup = {
  targetType: "issue" | "comment";
  targetId: string;
  count: number;
  reasons: Partial<Record<FlagReason, number>>;
  notes: string[];
  firstAt: string;
  lastAt: string;
  issue: { id: string; ticket: string; category: Category; customLabel: string | null; customIcon: string | null; status: Status; address: string | null; description: string } | null;
  comment: { body: string | null; author: string; hidden: boolean; deleted: boolean } | null;
};

export type CategorySla = { category: Category; slaHours: number; defaultHours: number; open: number };
