-- URLs de feeds editables + parámetros de rotación y flush.
alter table public.app_settings
  add column if not exists amazon_flash_feed_urls text,
  add column if not exists miravia_feed_urls text,
  add column if not exists kiabi_feed_urls text,
  add column if not exists amazon_department_feeds_per_run smallint not null default 3,
  add column if not exists miravia_feeds_per_run smallint not null default 1,
  add column if not exists kiabi_feeds_per_run smallint not null default 1,
  add column if not exists telegram_flush_limit smallint not null default 40;
