/**
 * Cancel every future RDV for the "mehdi test" sandbox patient.
 * Useful between WhatsApp tests so the double-booking guard tests
 * from a clean slate.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";
import { AppointmentStatus } from "@prisma/client";

async function main() {
  const patient = await db.patient.findFirst({
    where: {
      firstName: { contains: "mehdi", mode: "insensitive" },
      lastName: { contains: "test", mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!patient) {
    console.log("no patient");
    return;
  }
  const upd = await db.appointment.updateMany({
    where: {
      patientId: patient.id,
      startAt: { gt: new Date() },
      status: {
        in: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.RESCHEDULE_REQUESTED,
        ],
      },
    },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: "cleanup before retest",
    },
  });
  console.log(`Cancelled ${upd.count} future RDV for mehdi test`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
