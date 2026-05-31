/**
 * Wipe ALL invoices + related payments/plans for a clinic.
 *
 * Order of deletion (FK-aware):
 *   1. Payments        → FK to Invoice (cascade) + InvoicePlanInstallment
 *   2. Installments    → FK to PaymentPlan (cascade)
 *   3. PaymentPlans    → FK to Invoice
 *   4. InvoiceLines    → cascade from Invoice
 *   5. Invoices        → ⚠ HARD DELETE
 *
 * Usage:
 *   pnpm tsx scripts/purge-invoices.ts --dry-run
 *   pnpm tsx scripts/purge-invoices.ts --confirm
 *
 * Always run --dry-run first to see counts.
 */

import "dotenv/config";
import { db } from "@/lib/db/client";

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const confirmed = args.has("--confirm");

  if (!dryRun && !confirmed) {
    console.log("Usage: pnpm tsx scripts/purge-invoices.ts --dry-run | --confirm");
    process.exit(1);
  }

  const clinics = await db.clinic.findMany({ select: { id: true, name: true } });
  console.log(`\n🏥 ${clinics.length} clinic(s) en DB.`);

  const counts = await Promise.all([
    db.invoice.count(),
    db.invoiceLine.count(),
    db.payment.count(),
    db.paymentPlan.count(),
    db.paymentPlanInstallment.count(),
  ]);
  const [invoiceCount, lineCount, paymentCount, planCount, instCount] = counts;

  console.log(`\n📊 Avant purge :`);
  console.log(`   Invoices             : ${invoiceCount}`);
  console.log(`   InvoiceLines         : ${lineCount}`);
  console.log(`   Payments             : ${paymentCount}`);
  console.log(`   PaymentPlans         : ${planCount}`);
  console.log(`   PaymentPlanInstallments : ${instCount}`);

  if (invoiceCount === 0) {
    console.log("\n✅ Rien à supprimer.");
    return;
  }

  if (dryRun) {
    console.log("\n🟡 DRY RUN — aucun changement effectué.");
    console.log("   Pour exécuter pour de vrai : pnpm tsx scripts/purge-invoices.ts --confirm");
    return;
  }

  console.log("\n🔴 Suppression en cours dans une transaction…");

  await db.$transaction(async (tx) => {
    const a = await tx.payment.deleteMany();
    const b = await tx.paymentPlanInstallment.deleteMany();
    const c = await tx.paymentPlan.deleteMany();
    const d = await tx.invoiceLine.deleteMany();
    const e = await tx.invoice.deleteMany();
    console.log(`   payments       : ${a.count} supprimés`);
    console.log(`   installments   : ${b.count} supprimés`);
    console.log(`   paymentPlans   : ${c.count} supprimés`);
    console.log(`   invoiceLines   : ${d.count} supprimés`);
    console.log(`   invoices       : ${e.count} supprimés`);

    // Reset invoice starting number to a fresh random in [1000, 9999] per
    // clinic — obscures billing volume from scratch (SPEC §4.8).
    for (const c of clinics) {
      const newStart = 1000 + Math.floor(Math.random() * 9000);
      await tx.clinic.update({
        where: { id: c.id },
        data: { invoiceStartingNumber: newStart },
      });
      console.log(`   ${c.name}: nouveau invoiceStartingNumber = ${newStart}`);
    }
  });

  console.log("\n✅ Purge terminée.");
  console.log("\n💡 Note : les TreatmentApplication restent. Elles peuvent être facturées à nouveau.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
