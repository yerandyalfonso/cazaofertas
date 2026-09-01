-- Ajustes operativos editables desde el admin (singleton app_settings).
alter table public.app_settings
  add column if not exists miravia_telegram_min_score numeric(6, 2) not null default 55,
  add column if not exists kiabi_telegram_min_score numeric(6, 2) not null default 75,
  add column if not exists telegram_flush_reschedule_minutes smallint not null default 20,
  add column if not exists amazon_associate_tag text,
  add column if not exists amazon_flash_insert_limit smallint not null default 4,
  add column if not exists miravia_deals_enabled boolean not null default true,
  add column if not exists miravia_min_discount_percent numeric(5, 2) not null default 15,
  add column if not exists miravia_discovery_max_items smallint not null default 60,
  add column if not exists miravia_flash_limit smallint not null default 3,
  add column if not exists miravia_flash_update_limit smallint not null default 2,
  add column if not exists kiabi_deals_enabled boolean not null default false,
  add column if not exists kiabi_min_discount_percent numeric(5, 2) not null default 10,
  add column if not exists kiabi_discovery_max_items smallint not null default 100,
  add column if not exists kiabi_new_products_only boolean not null default true;
