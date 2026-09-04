import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/authorization";

export async function GET() {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const { data, error } = await supabase.from("platform_settings").select("*").eq("id", true).single();
    if (error) return NextResponse.json({ error: "Unable to load settings." }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to load settings." }, { status });
  }
}

interface SettingsPatchInput {
  insuranceWaiverEnabled?: boolean;
  insuranceWaiverDailyRate?: number | null;
  insuranceWaiverCurrency?: string;
  cdcMembershipEnabled?: boolean;
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireCapability("can_manage_platform");
    const body = await request.json() as SettingsPatchInput;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.insuranceWaiverEnabled !== undefined) update.insurance_waiver_enabled = body.insuranceWaiverEnabled;
    if (body.insuranceWaiverDailyRate !== undefined) update.insurance_waiver_daily_rate = body.insuranceWaiverDailyRate;
    if (body.insuranceWaiverCurrency !== undefined) update.insurance_waiver_currency = body.insuranceWaiverCurrency;
    if (body.cdcMembershipEnabled !== undefined) update.cdc_membership_enabled = body.cdcMembershipEnabled;

    const { data, error } = await supabase.from("platform_settings").update(update).eq("id", true).select().single();
    if (error) return NextResponse.json({ error: "Unable to save settings." }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    const status = message === "AUTHENTICATION_REQUIRED" ? 401 : message === "CAPABILITY_REQUIRED" ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? "Admin access required." : "Unable to save settings." }, { status });
  }
}
