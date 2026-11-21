import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Enums } from "@/lib/supabase/database.types";

export type AppRole = Enums<"app_role">;

/** Where each role starts: students manage their own bookings, admins oversee all. */
export function homePathFor(role: AppRole): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
};

/**
 * The signed-in user plus their application role, or null.
 *
 * - Identity comes from getClaims(), which verifies the JWT signature, so a
 *   tampered cookie can't impersonate another user.
 * - The role is read from public.profiles (not from user_metadata, which the
 *   user controls). Reading it per request means a role change takes effect
 *   immediately, without waiting for the user's token to refresh.
 * - Wrapped in React cache() so a layout, a page and its children share one
 *   lookup per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", claims.sub)
    .single();

  if (error) {
    // No row: the sign-up trigger should always create one, so flag it but
    // treat the user as signed out rather than crash.
    if (error.code === "PGRST116") {
      logger.warn("signed-in user has no profile row", { userId: claims.sub });
      return null;
    }
    // Anything else (database down, permissions) is a real failure. Throwing
    // shows an error page instead of silently "signing the user out".
    logger.error("profile lookup failed", { userId: claims.sub, pgCode: error.code });
    throw new AppError(503, "auth_unavailable", "We couldn't verify your account right now.", {
      cause: error,
    });
  }

  return { id: profile.id, email: profile.email, role: profile.role };
});
