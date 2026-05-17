/**
 * Patient detail layout with a parallel `@modal` slot.
 *
 * Intercepts `/patients/[id]/edit` when navigated from `/patients/[id]`,
 * rendering the edit form in a dialog on top of the detail page. Refresh
 * or shared links fall back to the standalone `/patients/[id]/edit` page.
 */
export default function PatientDetailLayout({
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
