import type { UserRole } from "../models/User";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  createdAt: Date;
};

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    department: user.department ?? null,
    createdAt: user.createdAt,
  };
}
