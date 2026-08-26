alter table public.alerts
  add column if not exists keyword text;

create index if not exists idx_alerts_keyword on public.alerts (keyword);
