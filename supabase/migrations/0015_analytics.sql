-- yoRento: lightweight first-party pageview tracking for the admin
-- traffic tab. No IP storage, no third-party analytics vendor — just
-- path, a client-generated session id (localStorage, not a cookie you'd
-- need consent banners for), referrer, and a platform column so a
-- future native app can log its own events into the same table.
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text,
  session_id text not null,
  platform text not null default 'web' check (platform in ('web', 'ios', 'android')),
  device_type text not null default 'desktop' check (device_type in ('desktop', 'mobile', 'tablet')),
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx on public.page_views (path);

alter table public.page_views enable row level security;

-- Anyone (including anonymous visitors) can log a pageview, but never
-- read any back — this is a write-only firehose from the client's
-- perspective.
drop policy if exists "anyone logs a pageview" on public.page_views;
create policy "anyone logs a pageview" on public.page_views for insert with check (true);

drop policy if exists "platform admins read page views" on public.page_views;
create policy "platform admins read page views" on public.page_views for select using (public.is_platform_admin());
