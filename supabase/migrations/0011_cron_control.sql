-- Control de crons: pausa preventiva ante bloqueos Amazon.
create table if not exists public.cron_control (
  id text primary key default 'default',
  paused_until timestamptz null,
  pause_reason text null,
  consecutive_denials integer not null default 0,
  last_denial_at timestamptz null,
  last_success_at timestamptz null,
  updated_at timestamptz not null default now()
);

insert into public.cron_control (id)
values ('default')
on conflict (id) do nothing;
