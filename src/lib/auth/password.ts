import { hash, verify } from "@node-rs/argon2";

// Argon2id parameters tuned for ~50-100ms on a modern server CPU.
// See OWASP password storage cheat sheet.
const ARGON2_OPTIONS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false;
  }
}
