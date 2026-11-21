import { CalendarCheck2, CalendarClock, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";

const POINTS = [
  { icon: CalendarClock, text: "Book a consultation in under a minute" },
  { icon: CalendarCheck2, text: "Reschedule, cancel and tick off sessions" },
  { icon: ShieldCheck, text: "Your bookings are private to you" },
];

/** Shared frame for login, sign-up and password pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <Brand href="/" className="[&>span:first-child]:bg-white/15" />
        <div className="relative grid gap-6">
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Consultations with your tutors, organised in one place.
          </h2>
          <ul className="grid gap-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <Icon className="size-5 shrink-0" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/70">Mini LMS</p>
      </aside>

      <div className="flex flex-col">
        <div className="p-6 lg:hidden">
          <Brand href="/" />
        </div>
        <div className="flex flex-1 items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
