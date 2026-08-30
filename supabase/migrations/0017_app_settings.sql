-- Ajustes de producto editables desde admin (singleton).
create table if not exists public.app_settings (
  id text primary key default 'default',
  telegram_min_score numeric(6, 2) not null default 75,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, telegram_min_score)
values ('default', 75)
on conflict (id) do nothing;
