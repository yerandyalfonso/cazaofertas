-- Umbral de % descuento y espaciado mínimo entre publicaciones en
-- Facebook/Instagram (Meta), independiente del umbral de Telegram.
-- Meta limitó temporalmente la página por volumen de publicación (código 368
-- en Facebook, código 9 en Instagram) — se sube el umbral y se espacian los
-- envíos para no volver a disparar el bloqueo.

alter table public.app_settings
  add column if not exists meta_min_discount_percent numeric(5, 2) not null default 70,
  add column if not exists meta_post_interval_minutes smallint not null default 30,
  add column if not exists last_meta_post_at timestamp with time zone;

comment on column public.app_settings.meta_min_discount_percent is
  'Descuento mínimo (%) para publicar en Facebook/Instagram. Independiente del umbral de Telegram (suele ir más alto para publicar menos).';
comment on column public.app_settings.meta_post_interval_minutes is
  'Minutos mínimos entre publicaciones en Facebook/Instagram, para no disparar el límite de spam de Meta.';
comment on column public.app_settings.last_meta_post_at is
  'Última vez que se publicó con éxito en Facebook/Instagram (para respetar meta_post_interval_minutes).';
