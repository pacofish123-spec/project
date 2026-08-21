import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LegalDocumentPage, type LegalDocumentData } from "@/components/legal-document-page";

export const metadata: Metadata = { title: "Terms of Service | yoRento" };

export default async function TermsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("legal_documents").select("*").eq("slug", "terms-of-service").maybeSingle();
  return <LegalDocumentPage document={data as LegalDocumentData | null} backLabel="Back to yoRento" />;
}
