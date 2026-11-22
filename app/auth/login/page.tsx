import { Info } from "lucide-react";
import { LoginForm } from "@/components/login-form";

// Demo credentials live in the README rather than on this page, so no
// password is ever shown on the public site.
const DEMO_ACCOUNTS_URL = "https://github.com/anushagarg-10/mini-lms-consultations#test-accounts";

export default function Page() {
  return (
    <div className="flex w-full items-center justify-center p-6 md:p-10">
      <div className="grid w-full max-w-sm gap-4">
        <LoginForm />
        <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Reviewing this project? Student and admin demo accounts are listed in the{" "}
            <a
              href={DEMO_ACCOUNTS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              README
            </a>
            .
          </span>
        </p>
      </div>
    </div>
  );
}
