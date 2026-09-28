-- «Oferta Prime»: el precio guardado es el de oferta para Prime (el que Amazon
-- muestra por defecto); regular_price es el precio sin Prime. Se muestra la
-- etiqueta «Prime» en la web y en Telegram.
alter table public.products
  add column if not exists prime_only boolean not null default false,
  add column if not exists regular_price numeric(10, 2);

-- La vista usa p.*: hay que recrearla para que incluya las columnas nuevas.
drop view if exists public.marketplace_products;
create view public.marketplace_products
with (security_invoker = true) as
select p.*, g.variant_count
from public.products p
join (
  select
    id,
    row_number() over w as variant_rank,
    count(*) over (partition by coalesce(parent_asin, id::text)) as variant_count
  from public.products
  where is_active
  window w as (
    partition by coalesce(parent_asin, id::text)
    order by discount_percentage desc nulls last, current_price asc, id
  )
) g on g.id = p.id
where g.variant_rank = 1;

grant select on public.marketplace_products to anon, authenticated, service_role;
