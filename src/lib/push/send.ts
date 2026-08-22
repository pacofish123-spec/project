import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function configure() {
  if (configured || !isPushConfigured()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

// Pushes to every device a user has subscribed on (a person can have
// several — phone, laptop). Takes the admin client deliberately: the
// caller is pushing to someone ELSE (the other party in a
// conversation), and push_subscriptions' own RLS (user_id = auth.uid())
// never lets a non-owner read those rows.
export async function sendPushToUser(admin: SupabaseClient, userId: string, payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) return;
  configure();

  const { data: subscriptions } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("user_id", userId);
  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
        JSON.stringify(payload),
      );
    } catch (error) {
      // 404/410 means the browser dropped this subscription
      // (uninstalled, permission revoked, storage cleared) — clean it
      // up so nothing keeps retrying it. Any other error (a network
      // blip, the push service having a bad moment) isn't proof the
      // subscription is dead, so it's left alone.
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }));
}
