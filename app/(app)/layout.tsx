import { redirect } from "next/navigation";
import { getCurrentUser, homePathFor } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks } from "@/components/nav-links";
import { ThemeSwitcher } from "@/components/theme-switcher";

/** Shell for every signed-in page. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  // One area per role: students manage their own consultations; admins see
  // everyone's, read-only. Admins don't book, so they get no dashboard.
  const links =
    user.role === "admin"
      ? [{ href: "/admin", label: "All consultations" }]
      : [{ href: "/dashboard", label: "My consultations" }];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4">
          <Brand href={homePathFor(user.role)} />
          <div className="hidden sm:block">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="hidden items-center gap-2 md:flex">
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase text-accent-foreground">
                {user.email.charAt(0)}
              </span>
              <span className="text-muted-foreground">{user.email}</span>
            </div>
            {user.role === "admin" && <Badge>Admin</Badge>}
            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </nav>
        {/* Small screens: links on their own row */}
        <div className="border-t px-4 py-2 sm:hidden">
          <NavLinks links={links} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
