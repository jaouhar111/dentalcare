import { PageSpinner } from "@/components/ui/spinner";

/**
 * Default loading UI for any dashboard route. Next.js fires this during
 * Server Component data fetches > ~100 ms (App Router Suspense convention).
 * The spinner shows inside the main scroll area; the sidebar + topbar
 * stay visible thanks to the parallel `layout.tsx`.
 */
export default function DashboardLoading() {
  return <PageSpinner />;
}
