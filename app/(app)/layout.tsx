import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

/** Shell for every signed-in page. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <nav className="mx-auto flex h-16 w-full max-w-5xl items-center gap-6 px-4 text-sm">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="size-5" /> Mini LMS
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            My consultations
          </Link>
          {user.role === "admin" && (
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              Admin
            </Link>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            {user.role === "admin" && <Badge variant="secondary">Admin</Badge>}
            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
