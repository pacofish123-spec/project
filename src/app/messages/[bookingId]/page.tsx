"use client";

import { use, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Message {
  id: string;
  booking_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

export default function MessagesPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
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

  function load() {
    fetch(`/api/bookings/${bookingId}/messages`).then(async (response) => {
      const result = await response.json() as { messages?: Message[] };
      if (response.ok) setMessages(result.messages ?? []);
    }).catch(() => {});
  }

  useEffect(() => { load(); }, [bookingId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages]);

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
      <AppHeader />
      <main className="workflow-page tint-wash-ocean">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/trips"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("messagesTitle")}</p>
          <div className="message-thread">
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
            <button className="workflow-submit coral" type="submit" disabled={busy || !draft.trim()}><Send size={16} /> {t("sendMessage")}</button>
          </form>
        </section>
      </div>
      </main>
    </>
  );
}
