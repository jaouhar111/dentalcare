import { UserRole } from "@prisma/client";
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
 * Returns the current authenticated user or throws.
 * Use this at the top of every Server Action that mutates data.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
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
 * Returns the current user if their role matches one of the allowed roles.
 * Throws {@link UnauthorizedError} or {@link ForbiddenError} otherwise.
 */
export async function requireRole(allowed: UserRole[]): Promise<AuthenticatedUser> {
  const user = await requireAuth();
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
