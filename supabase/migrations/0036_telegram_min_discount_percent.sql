-- Umbral único de % descuento para encolar/publicar en Telegram (todas las tiendas).
-- El admin manda este valor; deja de usarse el score por tienda para el canal.

alter table public.app_settings
  add column if not exists telegram_min_discount_percent numeric(5, 2) not null default 20;

comment on column public.app_settings.telegram_min_discount_percent is
  'Descuento mínimo (%) para encolar/publicar en el canal Telegram. Aplica a todas las tiendas.';
