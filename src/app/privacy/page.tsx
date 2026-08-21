import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LegalDocumentPage, type LegalDocumentData } from "@/components/legal-document-page";

export const metadata: Metadata = { title: "Privacy Policy | yoRento" };

export default async function PrivacyPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("legal_documents").select("*").eq("slug", "privacy-policy").maybeSingle();
  return <LegalDocumentPage document={data as LegalDocumentData | null} backLabel="Back to yoRento" />;
}
