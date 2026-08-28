-- Multi-tienda (Amazon sigue siendo el default; filas existentes sin cambios de comportamiento).

alter table public.products
  add column if not exists retailer text not null default 'amazon',
  add column if not exists external_id text,
  add column if not exists product_url text;

alter table public.products
  drop constraint if exists products_retailer_check;

alter table public.products
  add constraint products_retailer_check
  check (retailer in ('amazon', 'kiabi', 'carrefour'));

update public.products
set
  external_id = coalesce(external_id, asin),
  product_url = coalesce(product_url, amazon_url)
where retailer = 'amazon';

create unique index if not exists products_retailer_external_id_key
  on public.products (retailer, external_id)
  where external_id is not null;

create index if not exists products_retailer_active_idx
  on public.products (retailer, is_active, last_checked_at);

-- Histórico de precios: fuente Kiabi.
alter table public.price_history
  drop constraint if exists price_history_source_check;

alter table public.price_history
  add constraint price_history_source_check
  check (source in ('seed', 'mock', 'amazon', 'keepa', 'kiabi'));

comment on column public.products.retailer is 'Tienda origen: amazon (default), kiabi, carrefour.';
comment on column public.products.external_id is 'ID de ficha en la tienda (ASIN para Amazon, P…C… para Kiabi).';
comment on column public.products.product_url is 'URL canónica del producto en la tienda.';
