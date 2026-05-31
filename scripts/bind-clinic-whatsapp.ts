/**
 * One-shot: binds the first clinic to the dev test WhatsApp phone id.
 * Keeps the existing local tests working now that `resolveClinic` routes
 * by `phone_number_id`. Re-running is idempotent.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) {
    console.error("WHATSAPP_PHONE_ID missing");
    process.exit(1);
  }
  const clinic = await db.clinic.findFirst({
    select: { id: true, name: true, whatsappPhoneId: true },
  });
  if (!clinic) {
    console.log("(no clinic)");
    return;
  }
  if (clinic.whatsappPhoneId === phoneId) {
    console.log(`Already bound: ${clinic.name} → ${phoneId}`);
    return;
  }
  await db.clinic.update({
    where: { id: clinic.id },
    data: { whatsappPhoneId: phoneId },
  });
  console.log(`Bound ${clinic.name} → ${phoneId}`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
