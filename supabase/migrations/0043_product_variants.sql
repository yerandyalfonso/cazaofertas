-- Variantes de Amazon (talla, color…): cada una tiene ASIN propio pero
-- comparten parent_asin. Sin agruparlas, el canal enviaba el mismo producto
-- en varias variantes (p. ej. 21 mensajes de unas zapatillas en 24 h).
-- variant_info guarda las opciones para listarlas en el mensaje.

alter table products
  add column if not exists parent_asin text,
  add column if not exists variant_info jsonb;

create index if not exists idx_products_parent_asin
  on products (parent_asin)
  where parent_asin is not null;
