import type { Capability } from "./domain";
import { createSupabaseServerClient } from "./supabase/server";
import { hasCapability } from "./capabilities";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("AUTHENTICATION_REQUIRED");
  return { supabase, user };
}

export async function requireCapability(capability: Capability) {
  const { supabase, user } = await requireUser();
  if (!(await hasCapability(supabase, user.id, capability))) throw new Error("CAPABILITY_REQUIRED");
  return { supabase, user };
}
