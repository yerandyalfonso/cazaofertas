-- Fallos reales seguidos de una alerta de URL (producto no encontrado, sin
-- precio legible…; no cuentan bloqueos anti-bot ni «envío fuera de España»).
-- Tras ≥12 fallos durante ≥3 días se desactiva y se avisa al usuario.
alter table public.alerts
  add column if not exists fail_count int not null default 0,
  add column if not exists first_failed_at timestamptz;
