import type { AnnouncementLevel } from "@prisma/client";

/** Active platform announcement shown as a banner to cabinet users. */
export interface ActiveAnnouncement {
  id: string;
  message: string;
  level: AnnouncementLevel;
  createdAt: Date;
}
