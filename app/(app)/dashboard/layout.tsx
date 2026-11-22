import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";

/**
 * Role gate for the student dashboard. Like app/(app)/admin/layout.tsx, it
 * lives in the layout because the layout renders outside loading.tsx's
 * Suspense boundary: redirect() here happens before streaming starts, so an
 * admin gets a real HTTP redirect to /admin rather than a client-side one.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (user.role !== "student") redirect(homePathFor(user.role));
  return children;
}
