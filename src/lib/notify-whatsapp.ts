import type { SupabaseClient } from "@supabase/supabase-js";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/whatsapp";

// Fire-and-forget WhatsApp send alongside the in-app notification a
// booking lifecycle event already triggers (public.notify(), see
// 0006_messaging_notifications.sql) — never blocks or fails the
// underlying action: a WhatsApp hiccup (not configured, bad number,
// Meta downtime) is logged and swallowed, exactly like the rental
// agreement email in bookings/[bookingId]/route.ts already does for
// the same reason.
export async function notifyWhatsApp(supabase: SupabaseClient, userId: string, body: string): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  try {
    const { data: profile } = await supabase.from("profiles").select("phone").eq("id", userId).maybeSingle();
    if (!profile?.phone) return;
    await sendWhatsAppMessage(profile.phone, body);
  } catch (error) {
    console.error(`notifyWhatsApp failed for user ${userId}:`, error);
  }
}
