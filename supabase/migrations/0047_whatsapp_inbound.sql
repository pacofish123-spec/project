-- yoRento: inbound WhatsApp messages, logged for an admin to see and
-- follow up on — not routed into the booking-scoped `messages` table
-- (0006), since an inbound WhatsApp text often can't be tied to a
-- specific booking (a renter might just say "hi" with no context). A
-- full conversational assistant is a separate, larger scope (needs an
-- LLM in the loop and its own review) — this is the honest slice: log
-- it, match it to a profile if possible, notify an admin.
create table public.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  from_phone text not null,
  matched_user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index whatsapp_inbound_messages_matched_user_idx on public.whatsapp_inbound_messages (matched_user_id, created_at desc);

alter table public.whatsapp_inbound_messages enable row level security;

-- Admin-only — this is an operational inbox, not something a renter
-- or host reads through the API (they see their own WhatsApp app for
-- that).
create policy "platform admins read whatsapp inbound" on public.whatsapp_inbound_messages
  for select using (public.is_platform_admin());

revoke all on public.whatsapp_inbound_messages from authenticated, anon;
