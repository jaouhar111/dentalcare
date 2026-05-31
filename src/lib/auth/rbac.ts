import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "./index";

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clinicId: string;
  dentistId?: string;
  fullName?: string | null;
}

/**
 * Returns the current authenticated user.
 *
 * In a Server Component / page context: redirects to `/login` if no
 * session is present (better UX than the bare 500 error page that
 * came from throwing `UnauthorizedError`). `redirect()` throws an
 * internal Next.js signal, so the caller never sees a return when
 * the user is unauthenticated.
 *
 * In a Server Action context: redirect() also works — Next.js
 * propagates it to the client, which performs the navigation.
 *
 * The legacy `UnauthorizedError` is still exported for callers that
 * want to handle the case explicitly (e.g. JSON API routes) — but
 * the default behaviour is now a hard redirect.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    clinicId: session.user.clinicId,
    dentistId: session.user.dentistId,
    fullName: session.user.name,
  };
}

/**
 * Returns the current user if their role matches one of the allowed
 * roles. SUPER_ADMIN is an implicit pass on every gate — the platform
 * owner needs cross-tenant access to debug, support and recover any
 * cabinet. Pages that should be SUPER_ADMIN-only must pass
 * `[UserRole.SUPER_ADMIN]` explicitly and rely on the equality there.
 *
 * Throws {@link UnauthorizedError} or {@link ForbiddenError} otherwise.
 */
export async function requireRole(allowed: UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.role === UserRole.SUPER_ADMIN) return user;
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(`Role ${user.role} not allowed`);
  }
  return user;
}

/** Returns the current session user without throwing. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    clinicId: session.user.clinicId,
    dentistId: session.user.dentistId,
    fullName: session.user.name,
  };
}

export function canDeletePatient(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function canManageUsers(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function canViewMedicalRecord(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.DENTIST;
}

export function canRecordPayment(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.RECEPTIONIST;
}
