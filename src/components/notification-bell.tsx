"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useLanguage, localeByLanguage } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  function load() {
    fetch("/api/notifications").then(async (response) => {
      const result = await response.json() as { notifications?: Notification[] };
      if (response.ok) setNotifications(result.notifications ?? []);
    }).catch(() => {});
  }

  useEffect(() => { if (signedIn) load(); }, [signedIn]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!signedIn) return null;

  const unreadCount = (notifications ?? []).filter((notification) => !notification.read_at).length;

  async function markRead(notification: Notification) {
    if (!notification.read_at) {
      await fetch(`/api/notifications/${notification.id}`, { method: "PATCH" });
      load();
    }
    setOpen(false);
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    load();
  }

  return (
    <div className="lang-dropdown notification-bell" ref={rootRef}>
      <button className="profile-button" type="button" aria-label={t("notificationsTitle")} onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-dot" />}
      </button>
      {open && (
        <div className="lang-dropdown-menu notification-menu">
          <div className="notification-menu-head">
            <strong>{t("notificationsTitle")}</strong>
            {unreadCount > 0 && <button className="workflow-link" type="button" onClick={markAllRead}>{t("markAllRead")}</button>}
          </div>
          {notifications && notifications.length === 0 && <p className="admin-row-meta" style={{ padding: "8px 10px" }}>{t("notificationsEmpty")}</p>}
          {notifications && notifications.length > 0 && (
            <div className="notification-list">
              {notifications.map((notification) => {
                const content = (
                  <div className={`notification-item ${notification.read_at ? "" : "unread"}`} onClick={() => markRead(notification)}>
                    <strong>{notification.title}</strong>
                    {notification.body && <span>{notification.body}</span>}
                    <small>{formatDate(notification.created_at, localeByLanguage[language])}</small>
                  </div>
                );
                return notification.link ? <Link href={notification.link} key={notification.id} onClick={() => markRead(notification)}>{content}</Link> : <div key={notification.id}>{content}</div>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
