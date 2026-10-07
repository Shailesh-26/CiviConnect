import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { hashPassword } from "../utils/password";
import { registerSchema } from "../validators/auth.schemas";

async function main() {
  const parsed = registerSchema.safeParse({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
  });

  if (!parsed.success) {
    console.error("Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in server/.env first:");
    for (const issue of parsed.error.issues) {
      console.error(`- ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  const { name, email, password } = parsed.data;
  await mongoose.connect(env.MONGODB_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`${email} already exists with role "${existing.role}". Nothing changed.`);
  } else {
    await User.create({ name, email, passwordHash: await hashPassword(password), role: "admin" });
    console.log(`Admin created: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
