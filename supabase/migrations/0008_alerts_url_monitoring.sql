-- Alertas de usuario por URL de producto (Amazon) + metadatos de monitorización.
alter table public.alerts
  add column if not exists url text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_known_price numeric(10, 2);

create index if not exists idx_alerts_url
  on public.alerts (url)
  where url is not null;

create index if not exists idx_alerts_url_active
  on public.alerts (is_active, last_checked_at)
  where url is not null and is_active = true;

comment on column public.alerts.url is
  'URL de producto Amazon (opcional). Si está presente, el cron user-alerts la monitoriza.';
comment on column public.alerts.last_checked_at is
  'Última comprobación de precio para alertas con URL.';
comment on column public.alerts.last_known_price is
  'Último precio conocido al comprobar la URL de la alerta.';
