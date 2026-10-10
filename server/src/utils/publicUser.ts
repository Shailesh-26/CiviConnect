import { NOTIFY_KEYS, type NotifyKey, type UserRole } from "../models/User";

type Avatar = { emoji: string | null; color: string | null; url: string | null };

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  avatar: Avatar | null;
  bio: string | null;
  homeArea: string | null;
  homeLocation: { lat: number; lng: number } | null;
  radiusKm: number;
  notify: Record<NotifyKey, boolean>;
  createdAt: Date;
};

type UserLike = {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  avatar?: { emoji?: string | null; color?: string | null; url?: string | null } | null;
  bio?: string | null;
  homeArea?: string | null;
  homeLocation?: { lat?: number | null; lng?: number | null } | null;
  radiusKm?: number | null;
  notify?: Partial<Record<NotifyKey, boolean | null>> | null;
  createdAt: Date;
};

function toAvatar(avatar: UserLike["avatar"]): Avatar | null {
  if (!avatar || (!avatar.url && !avatar.emoji)) return null;
  return { emoji: avatar.emoji ?? null, color: avatar.color ?? null, url: avatar.url ?? null };
}

// The signed-in user's own view of their account. Never includes the password hash.
export function toPublicUser(user: UserLike): PublicUser {
  const loc = user.homeLocation;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    department: user.department ?? null,
    avatar: toAvatar(user.avatar),
    bio: user.bio || null,
    homeArea: user.homeArea || null,
    homeLocation: loc && typeof loc.lat === "number" && typeof loc.lng === "number" ? { lat: loc.lat, lng: loc.lng } : null,
    radiusKm: user.radiusKm ?? 2,
    notify: Object.fromEntries(NOTIFY_KEYS.map((key) => [key, user.notify?.[key] ?? true])) as Record<NotifyKey, boolean>,
    createdAt: user.createdAt,
  };
}

// What an admin sees in the user table: no home location or private preferences.
export function toAdminUser(user: UserLike) {
  const { homeLocation: _home, notify: _notify, ...rest } = toPublicUser(user);
  return rest;
}
