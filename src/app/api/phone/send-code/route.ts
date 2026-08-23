import { NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { requireUser } from "@/lib/authorization";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/whatsapp";
import { isSmsConfigured, sendSms } from "@/lib/sms";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function GET() {
  // Lets the /verify-phone page decide what to render (a channel
  // choice, a single "we'll text you" button, or neither) before the
  // renter/host picks anything.
  return NextResponse.json({ whatsapp: isWhatsAppConfigured(), sms: isSmsConfigured() });
}

interface SendCodeInput {
  phone?: string;
  channel?: "whatsapp" | "sms";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SendCodeInput;
    if (!body.phone?.trim()) return NextResponse.json({ error: "A phone number is required." }, { status: 400 });

    const whatsappOk = isWhatsAppConfigured();
    const smsOk = isSmsConfigured();
    if (!whatsappOk && !smsOk) return NextResponse.json({ error: "Phone verification isn't available yet." }, { status: 503 });

    // When both channels are configured, the caller has to say which
    // one — the UI offers both as explicit buttons. With only one
    // configured, that one is used regardless of what's passed.
    const channel = whatsappOk && smsOk ? body.channel : whatsappOk ? "whatsapp" : "sms";
    if (channel !== "whatsapp" && channel !== "sms") return NextResponse.json({ error: "Choose WhatsApp or SMS." }, { status: 400 });

    const { supabase } = await requireUser();
    const phone = body.phone.trim();
    const code = String(randomInt(100000, 999999));

    if (channel === "whatsapp") await sendWhatsAppMessage(phone, `Your yoRento verification code is ${code}. It expires in 10 minutes.`);
    else await sendSms(phone, `Your yoRento verification code is ${code}. It expires in 10 minutes.`);

    const { error } = await supabase.rpc("request_phone_verification_code", {
      target_phone: phone,
      target_channel: channel,
      target_code_hash: hashCode(code),
    });
    if (error) return NextResponse.json({ error: "Unable to start phone verification." }, { status: 500 });

    return NextResponse.json({ ok: true, channel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (message === "AUTHENTICATION_REQUIRED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
    return NextResponse.json({ error: "Unable to send a verification code." }, { status: 500 });
  }
}
