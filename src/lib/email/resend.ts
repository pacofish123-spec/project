import { Resend } from "resend";

let cachedClient: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_NOT_CONFIGURED");
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(input: { to: string; subject: string; html: string; attachments?: EmailAttachment[] }): Promise<void> {
  const client = getClient();
  const from = process.env.RESEND_FROM_EMAIL ?? "yoRento <onboarding@resend.dev>";
  const { error } = await client.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments?.map((attachment) => ({ filename: attachment.filename, content: attachment.content })),
  });
  if (error) throw new Error(`EMAIL_SEND_FAILED: ${error.message}`);
}
