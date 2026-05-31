/**
 * One-shot: assigns a slug to every existing Clinic that doesn't have
 * one yet (legacy rows pre-dating the multi-tenant schema). Idempotent
 * — re-running is a no-op.
 */
import "dotenv/config";
import { db } from "@/lib/db/client";
import { slugify } from "@/lib/utils/slug";

async function main() {
  const clinics = await db.clinic.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });
  for (const c of clinics) {
    let candidate = slugify(c.name);
    let suffix = 1;
    while (await db.clinic.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      suffix += 1;
      candidate = `${slugify(c.name)}-${suffix}`;
    }
    await db.clinic.update({ where: { id: c.id }, data: { slug: candidate } });
    console.log(`  ✓ ${c.name.padEnd(28)} → ${candidate}`);
  }
  console.log(`\nDone. ${clinics.length} clinic(s) backfilled.`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
