# Backup & Restore

DentalCare persists patient data — medical histories, radiographs,
prescriptions, invoices. Losing any of this is a CNDP/loi 09-08 incident,
not just a technical mishap. This document is the runbook.

---

## What we back up

| Data                                  | Where it lives        | Who owns the backup |
|---------------------------------------|------------------------|---------------------|
| All app data (patients, appointments, treatments, invoices, audit log, …) | Neon Postgres          | Neon (automated) + manual `pg_dump` (us, weekly) |
| Radiographs, treatment photos         | Cloudinary             | Cloudinary (replicated by default) |
| Generated PDFs (invoices, prescriptions) | Cloudinary           | Cloudinary; also re-generatable from DB |
| Uploaded source files (CIN, ordonnances reçues) | Cloudinary       | Cloudinary |
| Secrets (`.env` values)               | Vercel + 1Password (or paper, kept in the clinic safe) | The clinic owner |

We do NOT back up the Next.js build artefacts — they are rebuilt from
source on every deploy.

---

## Neon — automatic snapshots

Neon automatically captures point-in-time snapshots every 24 hours,
retained for **7 days on the Free plan, 30 days on Launch+**. Nothing to
configure beyond billing tier.

Restore via **point-in-time** is the recommended primary recovery path: it
gives a fully consistent DB at any second of the retention window.

---

## Manual weekly export — required

Neon's automatic snapshots stay inside Neon. If Neon itself is unavailable
(account compromise, billing issue, vendor outage), we have nothing. So we
also keep an **off-Neon** dump.

### 1. One-time setup

```powershell
# Install pg_dump (PostgreSQL 16+ client tools)
winget install PostgreSQL.PostgreSQL.16

# Create an S3-compatible bucket somewhere outside Neon's blast radius
# (Backblaze B2, Cloudflare R2, OVHcloud Object Storage — pick one not on
# Vercel/AWS to avoid correlated failures).
```

### 2. Weekly dump procedure

Run from a machine that has the production `DIRECT_URL` (laptop is fine, do
NOT commit the dump):

```powershell
$ts = Get-Date -Format "yyyy-MM-dd_HHmm"
$out = "dentalcare_$ts.dump"

# -F c → custom format (compressed, restore via pg_restore)
# --no-owner / --no-acl → portable across destinations (Neon → restore in any PG)
pg_dump --no-owner --no-acl -F c -f $out $env:DIRECT_URL

# Encrypt before upload — the dump contains patient PII.
gpg --symmetric --cipher-algo AES256 --output "$out.gpg" $out
Remove-Item $out

# Upload to off-Neon storage. Example: Backblaze B2 via rclone.
rclone copy "$out.gpg" b2:dentalcare-backups/weekly/
```

Schedule this once a week — Sunday evening is a good slot. Set a calendar
reminder; do not rely on memory.

### 3. Quarterly restore drill

A backup you have never restored is not a backup. Once a quarter, restore
the latest dump to a throwaway Neon branch and verify:

```powershell
# Decrypt
gpg --decrypt "dentalcare_YYYY-MM-DD_HHMM.dump.gpg" > restored.dump

# Create a Neon branch from the prod project for the test (Neon → Branches → Create)
# Get the branch's DIRECT_URL, then:
pg_restore --no-owner --no-acl -d $env:TEST_DIRECT_URL restored.dump

# Spot check
psql $env:TEST_DIRECT_URL -c "SELECT COUNT(*) FROM `"Patient`";"
psql $env:TEST_DIRECT_URL -c "SELECT COUNT(*) FROM `"Appointment`";"
```

Document the date + row counts in `docs/operations/restore-log.md`.

---

## Recovery scenarios

### A. Accidental data deletion (single row / table)

1. Open Neon → **Branches → Create branch from history**, pick a timestamp
   just before the deletion.
2. Connect to the new branch with `psql`, copy the affected rows
   (`COPY (SELECT … FROM "Patient" WHERE id = '…') TO STDOUT`).
3. Insert back into production via `psql $DIRECT_URL`.
4. Add an entry to the audit log explaining the manual correction.

### B. Full DB corruption / catastrophic failure

1. Verify the issue is not transient (Neon status page, retry after 5 min).
2. Create a new Neon branch from the latest healthy timestamp (point-in-
   time restore — usually < 1 min after, no full restore needed).
3. Promote the branch to primary via Neon dashboard.
4. Update `DATABASE_URL` and `DIRECT_URL` in Vercel to the new branch's
   connection strings — wait for the redeploy to take effect.
5. Hit `/api/health` to confirm.
6. Post-mortem in `docs/operations/incidents/<date>.md`.

### C. Neon account unavailable

1. Spin up Postgres elsewhere — Render, RDS, Supabase, or self-hosted.
2. Decrypt the latest weekly dump (`gpg --decrypt`).
3. `pg_restore --no-owner --no-acl -d <new-DATABASE_URL> dentalcare_*.dump`.
4. Apply the latest migration baseline:
   `pnpm prisma migrate resolve --applied <last-migration-name>`.
5. Update Vercel env vars to point at the new instance.

### D. Cloudinary asset loss

Patient-uploaded photos and radiographs only exist on Cloudinary. We can
re-issue PDFs from the DB (invoices, prescriptions) but cannot recover
lost source images. Mitigations:

- Cloudinary replicates within their CDN automatically. Loss of a single
  asset is rare.
- For Pro plans, enable **Backup storage** (paid add-on) which keeps
  versioned copies of every upload.
- For Free plan: encourage clinics to keep originals on a local NAS as a
  belt-and-braces measure. Document this in the onboarding flow.

---

## Retention policy

CNDP / Loi 09-08 (Maroc) treats dental records as **medical data**:
retention is at least **10 years** after the patient's last visit (or
until the patient turns 28, whichever is later, for minors).

- DB rows are soft-deleted (`deletedAt` is set, no row is `DELETE`d) so the
  audit trail stays intact.
- Cloudinary assets keep their `dentalcare/<clinicId>/...` folder layout —
  the entire folder can be GDPR-exported as a zip on patient request.
- Yearly snapshots (1st January each year) are kept indefinitely until the
  10-year retention window expires.

When a patient invokes their right to deletion (loi 09-08 art. 8):

1. Use the in-app **Patient → Export GDPR** flow (Phase 14).
2. Hard-delete via `tsx scripts/gdpr-purge.ts --patient-id=<id>` (writes a
   tombstone audit entry, then `DELETE`s the underlying rows + Cloudinary
   folder).
3. Confirm purge in the next weekly backup verification (the dump should no
   longer contain that patient's rows).
