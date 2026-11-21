import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * Role gate for everything under /admin.
 * It lives in the layout (not only the page) because the layout renders
 * outside loading.tsx's Suspense boundary: notFound() here runs before any
 * streaming starts, so non-admins get a real 404 status and title.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // 404 rather than 403 so the page's existence isn't advertised.
  if (user?.role !== "admin") notFound();
  return children;
}
