"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2, MessageCircle, User, X } from "lucide-react";
import { MessageThread } from "@/components/message-thread";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { enablePushNotifications, getNotificationPermission, isPushSupported } from "@/lib/push/client";

interface Conversation {
  booking_id: string;
  vehicle_make: string;
  vehicle_model: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_is_business: boolean;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_is_mine: boolean | null;
  unread_count: number;
}

// Same screens the mobile bottom nav already hides itself on — a
// full-screen auth/admin flow shouldn't have a floating chat bubble
// sitting over it either.
const hiddenRoots = ["/admin", "/sign-in", "/sign-up", "/auth", "/onboarding", "/recover"];

const PUSH_PROMPT_DISMISSED_KEY = "yorento-push-prompt-dismissed";

function formatConversationTime(value: string, locale: string): string {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function MessagingWidget() {
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [pushDismissed, setPushDismissed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadInbox = useCallback(() => {
    fetch("/api/messages/inbox").then(async (response) => {
      const result = await response.json() as { conversations?: Conversation[] };
      if (response.ok) setConversations(result.conversations ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (signedIn) loadInbox(); }, [signedIn, loadInbox]);

  // Realtime: a new message on ANY of the caller's threads refreshes
  // the list — RLS scopes this to their own bookings automatically
  // (Supabase enforces a table's RLS for postgres_changes subscribers
  // too), so no manual filtering by participant is needed here.
  useEffect(() => {
    if (!signedIn) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("messaging-widget-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadInbox())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [signedIn, loadInbox]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Ask at most once per browser per dismissal — shown inside the
  // panel (not on page load) so it only ever appears when someone's
  // already engaging with messaging, not as a cold-open interruption.
  // A pure derived value rather than effect-driven state: signedIn only
  // flips true post-hydration (see the auth-check effect above), so by
  // the time this reaches the `typeof window` check it's always
  // client-side — no SSR/hydration mismatch to guard against.
  const pushPromptVisible = open && signedIn && !pushDismissed && !pushEnabled
    && typeof window !== "undefined" && isPushSupported()
    && getNotificationPermission() === "default"
    && !window.localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY);

  async function handleEnablePush() {
    setPushBusy(true);
    const result = await enablePushNotifications();
    setPushBusy(false);
    // Denied or unsupported gets treated the same as a dismissal —
    // don't keep asking again this session either way.
    if (result.ok) setPushEnabled(true);
    else setPushDismissed(true);
  }

  function dismissPushPrompt() {
    window.localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
    setPushDismissed(true);
  }

  if (!signedIn) return null;
  if (hiddenRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return null;

  const unreadTotal = (conversations ?? []).reduce((sum, conversation) => sum + conversation.unread_count, 0);
  const activeConversation = conversations?.find((conversation) => conversation.booking_id === activeBookingId) ?? null;

  function openConversation(bookingId: string) {
    setActiveBookingId(bookingId);
    // Optimistic — the thread view's own load() marks it read
    // server-side; this just stops the badge flashing a stale count
    // until the next refresh.
    setConversations((current) => current?.map((conversation) => (conversation.booking_id === bookingId ? { ...conversation, unread_count: 0 } : conversation)) ?? current);
  }

  return (
    <div className="messaging-widget" ref={rootRef}>
      {open && (
        <div className="messaging-panel">
          <div className="messaging-panel-head">
            {activeConversation ? (
              <>
                <button className="messaging-icon-btn" type="button" aria-label={t("messagingBackToList")} onClick={() => setActiveBookingId(null)}><ArrowLeft size={16} /></button>
                <div className="messaging-panel-head-title">
                  <strong>{activeConversation.other_display_name ?? t("messagesTitle")}</strong>
                  <small>{activeConversation.vehicle_make} {activeConversation.vehicle_model}</small>
                </div>
              </>
            ) : (
              <strong>{t("messagesTitle")}</strong>
            )}
            <button className="messaging-icon-btn" type="button" aria-label={t("close")} onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          {!activeConversation && (
            <div className="conversation-list">
              {conversations && conversations.length === 0 && <p className="admin-row-meta" style={{ padding: "16px 14px" }}>{t("messagingInboxEmpty")}</p>}
              {conversations?.map((conversation) => (
                <button className="conversation-row" type="button" key={conversation.booking_id} onClick={() => openConversation(conversation.booking_id)}>
                  <span className="conversation-avatar">
                    {conversation.other_avatar_url
                      ? <img src={conversation.other_avatar_url} alt="" />
                      : (conversation.other_is_business ? <Building2 size={18} /> : <User size={18} />)}
                  </span>
                  <span className="conversation-meta">
                    <span className="conversation-meta-top">
                      <strong>{conversation.other_display_name ?? "—"}</strong>
                      {conversation.last_message_at && <small>{formatConversationTime(conversation.last_message_at, localeByLanguage[language])}</small>}
                    </span>
                    <span className="conversation-preview">
                      {conversation.last_message_body
                        ? `${conversation.last_message_is_mine ? `${t("messagingYouPrefix")} ` : ""}${conversation.last_message_body}`
                        : `${conversation.vehicle_make} ${conversation.vehicle_model}`}
                    </span>
                  </span>
                  {conversation.unread_count > 0 && <span className="conversation-unread-badge">{conversation.unread_count}</span>}
                </button>
              ))}

              {pushPromptVisible && (
                <div className="messaging-push-prompt">
                  <p>{t("messagingEnableNotificationsBody")}</p>
                  <div className="messaging-push-actions">
                    <button className="workflow-link" type="button" onClick={dismissPushPrompt}>{t("notNowAction")}</button>
                    <button className="workflow-submit coral" type="button" disabled={pushBusy} onClick={handleEnablePush}>{t("messagingEnableNotifications")}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeConversation && (
            <div className="messaging-thread-panel">
              <MessageThread bookingId={activeConversation.booking_id} compact onMessagesRead={loadInbox} />
            </div>
          )}
        </div>
      )}

      <button className="messaging-fab" type="button" aria-label={t("messagesTitle")} onClick={() => setOpen((value) => !value)}>
        <MessageCircle size={22} />
        {unreadTotal > 0 && <span className="messaging-fab-badge">{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
      </button>
    </div>
  );
}
