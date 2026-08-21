import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { formatDate } from "@/lib/format";

interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDocumentData {
  title: string;
  version: number;
  effective_date: string;
  updated_at: string;
  sections: LegalSection[];
}

// Shared renderer for /privacy and /terms — both are the same shape
// (a versioned document made of heading + paragraph sections), stored
// in legal_documents so either can be updated without a code deploy.
export function LegalDocumentPage({ document, backLabel }: { document: LegalDocumentData | null; backLabel: string }) {
  return (
    <>
      <AppHeader />
      <main className="workflow-page">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {backLabel}</Link></div>
          <section className="workflow-card wide legal-document-card">
            {!document && <p className="workflow-error">This document isn&apos;t available right now.</p>}
            {document && (
              <>
                <h1>{document.title}</h1>
                <p className="admin-row-meta" style={{ marginBottom: 28 }}>Effective {formatDate(document.effective_date)} · Version {document.version}</p>
                {document.sections.map((section) => (
                  <div className="legal-document-section" key={section.heading}>
                    <h2>{section.heading}</h2>
                    {section.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
