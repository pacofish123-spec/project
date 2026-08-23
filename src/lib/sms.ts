// Twilio SMS — no SDK, same hand-rolled-fetch style as paypal.ts and
// whatsapp.ts. Chosen as the SMS channel because there's no existing
// SMS provider anywhere in this codebase to match, Twilio sends to
// Dominican Republic numbers without issue, and its REST API is a
// single form-encoded POST with no extra dependency. Env-var-gated the
// same way every other provider here is.
function isSmsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export { isSmsConfigured };

export async function sendSms(toPhone: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) throw new Error("SMS_NOT_CONFIGURED");

  const to = toPhone.startsWith("+") ? toPhone : `+${toPhone.replace(/[^\d]/g, "")}`;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SMS_SEND_FAILED: ${response.status} ${detail}`);
  }
}
