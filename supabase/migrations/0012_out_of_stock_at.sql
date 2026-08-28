-- Marca cuándo se detectó agotado por primera vez (para desactivar tras N días).
alter table products
  add column if not exists out_of_stock_at timestamptz;

comment on column products.out_of_stock_at is
  'Primera detección de OUT_OF_STOCK; el cron desactiva el producto tras OUT_OF_STOCK_DEACTIVATE_DAYS.';
