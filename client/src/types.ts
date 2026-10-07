export type Role = "citizen" | "officer" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  createdAt: string;
};
