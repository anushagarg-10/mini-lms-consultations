import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Only allow same-origin relative paths as the post-confirmation redirect.
 * The starter passed `next` straight to redirect(), which is an open redirect
 * (e.g. ?next=https://evil.example or ?next=//evil.example).
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (!token_hash || !type) {
    redirect(`/auth/error?error=${encodeURIComponent("No token hash or type")}`);
  }

  // redirect() works by throwing, so it must stay outside the try block.
  let errorMessage: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error) {
      logger.warn("email link verification failed", { type, code: error.code });
      errorMessage = error.message;
    }
  } catch (err) {
    logger.error("email link verification threw", { type, err });
    errorMessage = "We couldn't verify that link. Please try again.";
  }

  redirect(errorMessage ? `/auth/error?error=${encodeURIComponent(errorMessage)}` : next);
}
