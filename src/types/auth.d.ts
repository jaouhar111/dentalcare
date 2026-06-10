import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    clinicId: string;
    dentistId?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      clinicId: string;
      dentistId?: string;
    };
    /**
     * Present only while a SUPER_ADMIN is impersonating a cabinet user.
     * `user.*` then reflects the IMPERSONATED identity; `impersonator`
     * carries the real platform owner so the UI can show a banner and
     * the "stop" action can restore the original session.
     */
    impersonator?: {
      id: string;
      name: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    clinicId: string;
    dentistId?: string;
  }
}
