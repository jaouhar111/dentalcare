/**
 * Patients layout with a parallel `@modal` slot.
 *
 * When a user navigates from `/patients` to `/patients/new`, the
 * intercepted route `@modal/(.)new/page.tsx` renders into this slot
 * — on top of the list — instead of replacing it.
 *
 * A direct visit (refresh / shared link) to `/patients/new` falls back
 * to the standalone route `/patients/new/page.tsx`.
 */
export default function PatientsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
