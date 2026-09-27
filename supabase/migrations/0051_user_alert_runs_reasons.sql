-- Motivos de fallos/omisiones de cada ejecución de user-alerts
-- ({"Bloqueo anti-bot de la tienda": 3, ...}) para el aviso y las estadísticas.
alter table public.user_alert_runs
  add column if not exists reasons jsonb not null default '{}'::jsonb;
