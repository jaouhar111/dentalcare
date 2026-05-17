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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    clinicId: string;
    dentistId?: string;
  }
}
