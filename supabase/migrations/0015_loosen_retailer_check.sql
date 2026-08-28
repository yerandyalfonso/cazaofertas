-- Permite nuevas tiendas sin migración por cada slug (validación en la app).

alter table public.products
  drop constraint if exists products_retailer_check;

comment on column public.products.retailer is
  'Slug de tienda (amazon, kiabi, carrefour, …). Catálogo en src/lib/retailers.ts.';
