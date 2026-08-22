"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface Message {
  id: string;
  booking_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

// Shared between the standalone /messages/[bookingId] page and the
// floating messaging widget's open-conversation view — same thread,
// same realtime wiring, just different surrounding chrome. Realtime
// relies on messages' own RLS (Supabase enforces it for postgres_changes
// subscriptions too), so this only ever receives rows the signed-in
// user is actually allowed to see — see migration 0038.
export function MessageThread({ bookingId, compact = false, onMessagesRead }: {
  bookingId: string;
  compact?: boolean;
  onMessagesRead?: () => void;
}) {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase?.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
  }, []);

  const load = useCallback(() => {
    fetch(`/api/bookings/${bookingId}/messages`).then(async (response) => {
      const result = await response.json() as { messages?: Message[] };
      if (response.ok) { setMessages(result.messages ?? []); onMessagesRead?.(); }
    }).catch(() => {});
  }, [bookingId, onMessagesRead]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

  // Live updates: a new row lands here the moment the other party
  // sends it, no polling or manual refresh needed. Re-runs load()
  // rather than appending the raw payload so a message that arrives
  // while this thread is open also gets marked read immediately (the
  // GET route calls mark_messages_read as a side effect).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`messages-${bookingId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bookingId, load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    if (response.ok) { setDraft(""); load(); }
    setBusy(false);
  }

  return (
    <>
      <div className={`message-thread ${compact ? "compact" : ""}`}>
        {messages && messages.length === 0 && <p className="admin-row-meta">{t("messagesEmpty")}</p>}
        {messages && messages.map((message) => (
          <div className={`message-bubble ${message.sender_user_id === selfId ? "self" : ""}`} key={message.id}>
            <p>{message.body}</p>
            <small>{formatDate(message.created_at, localeByLanguage[language])}</small>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="message-composer" onSubmit={handleSubmit}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("messagePlaceholder")} />
        <button className="workflow-submit coral" type="submit" disabled={busy || !draft.trim()}><Send size={16} /> {!compact && t("sendMessage")}</button>
      </form>
    </>
  );
}
