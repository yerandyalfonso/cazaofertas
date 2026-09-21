-- Fallos de scrape consecutivos del mismo ASIN antes de desactivar el producto.
alter table public.app_settings
  add column if not exists asin_scrape_fail_threshold integer not null default 2;

comment on column public.app_settings.asin_scrape_fail_threshold is
  'Fallos de scrape consecutivos del mismo ASIN antes de desactivar (is_active=false).';
