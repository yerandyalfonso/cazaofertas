-- Moving averages on products + Telegram wizard session state

alter table public.products
  add column if not exists average_price_30d numeric(10, 2);

alter table public.products
  add column if not exists average_price_90d numeric(10, 2);

alter table public.users
  add column if not exists telegram_wizard jsonb;

comment on column public.products.average_price_30d is
  'Media móvil de precios observados en los últimos 30 días';
comment on column public.products.average_price_90d is
  'Media móvil de precios observados en los últimos 90 días';
comment on column public.users.telegram_wizard is
  'Borrador del wizard de alertas Telegram (JSON, TTL en app)';
