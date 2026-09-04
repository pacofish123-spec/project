import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { supportEmail } from "@/lib/marketplace-config";

interface ContactInput {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Escapes user input before it's interpolated into the email HTML body
// below — these four fields are fully attacker-controlled (no auth on
// this route), so without this a message could inject markup/links
// into whatever inbox reads it.
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as ContactInput;
    const name = input.name?.trim() ?? "";
    const email = input.email?.trim() ?? "";
    const phone = input.phone?.trim() ?? "";
    const message = input.message?.trim() ?? "";

    if (!name || !email || !phone || !message) {
      return NextResponse.json({ error: "Fill in every field." }, { status: 400 });
    }
    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (name.length > 200 || phone.length > 40) {
      return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: "Message is too long — keep it under 5000 characters." }, { status: 400 });
    }

    if (!isEmailConfigured()) {
      // Same reasoning as deliverRentalAgreement: no provider key set
      // in this environment. Surfaced as an error here (unlike that
      // fire-and-forget path) because this is the user's only way to
      // reach support — silently swallowing it would just look like a
      // successful submission that never arrives.
      return NextResponse.json({ error: "Contact form isn't available right now — email us directly instead." }, { status: 503 });
    }

    await sendEmail({
      to: supportEmail,
      subject: `New contact form message from ${name}`,
      replyTo: email,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("contact form error:", error);
    return NextResponse.json({ error: "Unable to send your message. Please try again." }, { status: 500 });
  }
}
