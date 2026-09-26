-- Clics de afiliado: conservar la atribución aunque se borre el producto.
--
-- product_id tenía ON DELETE CASCADE: al borrar un producto se borraban
-- también sus clics. Pasa a SET NULL y cada clic guarda una copia del
-- título/ASIN/tienda. user_agent permite auditar clics (p. ej. los del
-- rastreador de Facebook que se contaban como clics hasta 2026-09-24).

alter table public.affiliate_clicks
  add column if not exists product_title text,
  add column if not exists product_asin text,
  add column if not exists retailer text,
  add column if not exists user_agent text;

alter table public.affiliate_clicks
  alter column product_id drop not null;

alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_product_id_fkey;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

-- Rellenar los clics existentes cuyo producto sigue en la BD.
update public.affiliate_clicks c
set product_title = p.title,
    product_asin = p.asin,
    retailer = p.retailer
from public.products p
where c.product_id = p.id
  and c.product_title is null;
