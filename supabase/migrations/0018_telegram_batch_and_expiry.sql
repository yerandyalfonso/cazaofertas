-- Cola de Telegram + caducidad de oferta (si Amazon la publica).
create table if not exists public.app_settings (
  id text primary key default 'default',
  telegram_min_score numeric(6, 2) not null default 75,
  telegram_batch_hours numeric(4, 1) not null default 4,
  last_telegram_flush_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_settings
  add column if not exists telegram_batch_hours numeric(4, 1) not null default 4;

alter table public.app_settings
  add column if not exists last_telegram_flush_at timestamptz;

insert into public.app_settings (id, telegram_min_score, telegram_batch_hours)
values ('default', 75, 4)
on conflict (id) do nothing;

alter table public.products
  add column if not exists deal_expires_at timestamptz;

create index if not exists idx_channel_notifications_status_created
  on public.channel_notifications (status, created_at);
