import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase
      .from("verification_records")
      .select("*, vehicles(*)")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Unable to load verification records." }, { status: 500 });

    const requesterIds = [...new Set((data ?? []).map((record) => record.user_id).filter(Boolean))];
    const { data: requesters } = requesterIds.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", requesterIds)
      : { data: [] };
    const requesterNames = new Map((requesters ?? []).map((profile) => [profile.id, profile.display_name]));

    // Identity documents live in a private bucket — sign each path so
    // the admin queue can actually show the photo, the same way
    // vehicle-photos' public URLs just work for vehicle records.
    const documentPaths = (data ?? []).flatMap((record) => record.document_paths ?? []);
    const signedUrlByPath = new Map<string, string>();
    if (documentPaths.length > 0) {
      const { data: signed } = await supabase.storage.from("identity-documents").createSignedUrls(documentPaths, 3600);
      for (const entry of signed ?? []) {
        if (entry.signedUrl && entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }

    const records = (data ?? []).map((record) => ({
      ...record,
      requester_display_name: record.user_id ? requesterNames.get(record.user_id) ?? "—" : "—",
      document_urls: (record.document_paths ?? []).map((path: string) => signedUrlByPath.get(path)).filter(Boolean),
    }));

    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load verification records." }, { status });
  }
}
