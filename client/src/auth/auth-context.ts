import { createContext } from "react";
import type { User } from "../types";

export type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  // Replace the signed-in user after a profile change.
  updateUser: (user: User) => void;
};

export const AuthContext = createContext<AuthState | null>(null);

// Why the server ended the session, kept for the login page to show once.
export const SIGNED_OUT_KEY = "cc:signed-out";
