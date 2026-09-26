-- Marketplace (Chollos de Hoy): una tarjeta por producto, no por variante.
--
-- Las variantes de Amazon (talla, color…) tienen ASIN propio pero comparten
-- parent_asin; sin agrupar, ~1/3 de las tarjetas repetían otra variante del
-- mismo producto. Esta vista deja, por grupo, la variante activa con más
-- descuento (a igualdad, la más barata) y cuántas variantes activas tiene.
-- Los productos sin parent_asin son su propio grupo.
--
-- security_invoker: respeta el RLS de products según quien consulte.

create or replace view public.marketplace_products
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
