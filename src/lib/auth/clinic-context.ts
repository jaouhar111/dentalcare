import { requireAuth } from "./rbac";

/**
 * Returns the `clinicId` of the current authenticated user.
 *
 * Use this at the top of every Server Action that queries multi-tenant data.
 * Combined with the Prisma extension in `lib/db/scoped-client.ts`, it ensures
 * a user from cabinet A can never read or write rows from cabinet B.
 */
export async function getClinicContext(): Promise<{ clinicId: string; userId: string }> {
  const user = await requireAuth();
  return { clinicId: user.clinicId, userId: user.id };
}
