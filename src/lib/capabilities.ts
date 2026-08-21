import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capability } from "./domain";

// Works with either the browser or server Supabase client (both are
// plain SupabaseClient instances) — a non-throwing capability check,
// for call sites that need a boolean rather than authorization.ts's
// throw-on-failure requireCapability().
export async function hasCapability(supabase: SupabaseClient, userId: string, capability: Capability): Promise<boolean> {
  const { data } = await supabase
    .from("user_capabilities")
    .select("capability")
    .eq("user_id", userId)
    .eq("capability", capability)
    .maybeSingle();
  return Boolean(data);
}
