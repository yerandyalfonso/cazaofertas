-- Resultado de cada ejecución de user-alerts (VPS y Mac) para las
-- estadísticas del test de carga de alertas. Filas pequeñas (~120/día).
create table if not exists public.user_alert_runs (
  id bigint generated always as identity primary key,
  machine text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  checked int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  price_drops int not null default 0,
  notified int not null default 0
);

create index if not exists idx_user_alert_runs_started on public.user_alert_runs (started_at desc);
alter table public.user_alert_runs enable row level security;
