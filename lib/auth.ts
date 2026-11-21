import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type AppRole = Enums<"app_role">;

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

  if (error || !profile) return null;

  return { id: profile.id, email: profile.email, role: profile.role };
});
