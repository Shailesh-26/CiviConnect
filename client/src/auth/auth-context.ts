import { createContext } from "react";
import type { User } from "../types";

export type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);
