-- Usuarios de prueba (test de carga de alertas): sus avisos van al chat
-- privado del admin (TELEGRAM_ADMIN_CHAT_ID) y no se propagan al canal ni a
-- redes. Se borran con scripts/alert-load-test/cleanup.mts.
alter table public.users
  add column if not exists is_test boolean not null default false;

create index if not exists idx_users_is_test on public.users (is_test) where is_test;
