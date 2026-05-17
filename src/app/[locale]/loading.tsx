import { PageSpinner } from "@/components/ui/spinner";

/**
 * Fallback loading UI for pages OUTSIDE the dashboard layout (login,
 * reset-password, confirm-appointment, legal/*). Renders a centered
 * spinner with no chrome — these pages have minimal layout to begin with.
 */
export default function LocaleLoading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <PageSpinner />
    </div>
  );
}
