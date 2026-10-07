import type { PublicUser } from "../utils/publicUser";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};
