import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is missing in server/.env"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
});

export const env = schema.parse(process.env);