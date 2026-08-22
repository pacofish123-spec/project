"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MessageThread } from "@/components/message-thread";
import { useLanguage } from "@/lib/i18n";

export default function MessagesPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const { t } = useLanguage();

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-ocean">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/trips"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("messagesTitle")}</p>
          <MessageThread bookingId={bookingId} />
        </section>
      </div>
      </main>
    </>
  );
}
