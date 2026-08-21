import { createClient } from "@supabase/supabase-js";

// SERVICE ROLE client — bypasses every RLS policy in the database.
//
// Rules for using this file:
// 1. Only call it from Route Handlers, after the caller has already
//    been verified as a platform admin via requireCapability
//    ("can_manage_platform") using the normal RLS-bound client.
// 2. Never import this into a "use client" component. The env var it
//    reads has no NEXT_PUBLIC_ prefix, so Next.js won't inline it into
//    the browser bundle even if this were imported client-side — but
//    don't rely on that as the only safeguard.
// 3. Use it only for the specific admin.* operations that genuinely
//    require service-role (banning/unbanning a user via Supabase Auth)
//    — not as a shortcut around RLS for anything else.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
