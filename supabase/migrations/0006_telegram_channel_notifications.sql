-- Tracking de alertas enviadas al canal de Telegram (broadcast).
alter table public.products
  add column if not exists last_telegram_notified_at timestamptz,
  add column if not exists last_telegram_notified_price numeric(10, 2),
  add column if not exists last_telegram_notified_score numeric(6, 2);

create table if not exists public.channel_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  score numeric(6, 2) not null,
  old_price numeric(10, 2),
  new_price numeric(10, 2) not null,
  discount_percentage numeric(6, 2),
  deal_level text,
  status text not null default 'pending',
  telegram_message_id bigint,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_notifications_product_created
  on public.channel_notifications (product_id, created_at desc);

create index if not exists idx_products_last_telegram_notified
  on public.products (last_telegram_notified_at desc);
