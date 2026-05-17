-- Postgres function that returns the next invoice number for a clinic.
-- Format: F-YYYY-NNNN where NNNN = invoiceStartingNumber + count(emitted invoices)
-- This keeps the seed value private (volume hiding) while remaining sequential.
--
-- Concurrency: we acquire a clinic-scoped advisory lock so two concurrent
-- emissions can't pick the same NNNN. The lock is per-transaction (xact) so
-- it's released automatically by COMMIT/ROLLBACK.
CREATE OR REPLACE FUNCTION next_invoice_number(p_clinic_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_start INT;
  v_count INT;
  v_year  TEXT;
BEGIN
  -- Best-effort lock: 32-bit int key derived from clinic id.
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  SELECT "invoiceStartingNumber" INTO v_start
    FROM clinics WHERE id = p_clinic_id;
  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Clinic % not found', p_clinic_id;
  END IF;

  -- Count emitted (number IS NOT NULL) invoices for this clinic, regardless
  -- of year — keeps the sequence monotonic across calendar years.
  SELECT COUNT(*) INTO v_count
    FROM invoices
    WHERE "clinicId" = p_clinic_id AND number IS NOT NULL;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  RETURN 'F-' || v_year || '-' || LPAD((v_start + v_count + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
