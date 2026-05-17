"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut } from "@/lib/auth";
import { isAllowed } from "@/lib/auth/rate-limit";
import { fail, ok, type Result } from "@/lib/utils/result";

const loginSchema = z.object({
  email: z.string().email("INVALID_EMAIL").toLowerCase().trim(),
  password: z.string().min(1, "REQUIRED"),
});

type LoginInput = z.infer<typeof loginSchema>;

export async function loginAction(
  input: LoginInput,
  redirectTo = "/",
): Promise<Result<null, { code: string; message: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("INVALID_INPUT", "Email or password invalid");
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateKey = `${ip}:${parsed.data.email}`;
  const guard = isAllowed(rateKey);
  if (!guard.allowed) {
    return fail("RATE_LIMITED", "Too many attempts, try again later");
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      ip,
      redirectTo,
    });
    return ok(null);
  } catch (e) {
    if (isRedirectError(e)) {
      // signIn() throws a redirect on success; rethrow so Next handles it.
      throw e;
    }
    return fail("INVALID_CREDENTIALS", "Invalid email or password");
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
