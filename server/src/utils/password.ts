import bcrypt from "bcryptjs";

const ROUNDS = 12;

// Compared against when an email is unknown, so login takes the same time
// whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync("placeholder-password-1", ROUNDS);

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);

export const verifyPassword = (plain: string, hash?: string) =>
  bcrypt.compare(plain, hash ?? DUMMY_HASH);
