-- Ajustes post-audit: evita falsos positivos y completa keywords útiles.
-- Idempotente.

-- 1) otros-libros: "manga" pilla "manga corta" (ropa) → "comic manga"
update public.category_keywords ck
set
  keywords = array_replace(ck.keywords, 'manga', 'comic manga'),
  updated_at = now()
from public.categories child
where ck.category_id = child.id
  and child.slug = 'otros-libros'
  and 'manga' = any (ck.keywords);

-- 2) Quitar keyword demasiado amplia "barrera seguridad" (escaleras adultas, etc.)
update public.category_keywords ck
set
  keywords = array_remove(ck.keywords, 'barrera seguridad'),
  updated_at = now()
where 'barrera seguridad' = any (ck.keywords);

-- 3) Añadir keywords concretas (solo si faltan)
with additions(lookup_slug, extra) as (
  values
  ('bebe-bebes', array[
    'cojin de lactancia', 'barrera seguridad ninos', 'barrera escalera', 'barrera ninos'
  ]::text[]),
  ('hogar-electrodomesticos', array[
    'nevera portatil', 'nevera electrica', 'frigorifico portatil', 'nevera de coche'
  ]::text[]),
  ('moda-general', array[
    'blusa', 'blusas', 'manga corta', 'manga larga', 'cuello pico', 'cuello en pico'
  ]::text[]),
  ('mascotas-general', array[
    'comida para perros', 'comida para gatos', 'pienso perros', 'pienso gatos',
    'alimento perros', 'alimento gatos', 'croquetas perros',
    'cortauñas perro', 'cortauñas gato', 'arena gatos', 'arena para gatos',
    'snacks para perros', 'adaptil', 'antiestrés perros'
  ]::text[])
),
resolved as (
  select c.id as category_id, a.extra
  from additions a
  join lateral (
    select child.id
    from public.categories child
    join public.categories parent on parent.id = child.parent_id
    where
      lower(child.slug) = lower(a.lookup_slug)
      or (
        lower(child.slug) = 'general'
        and lower(parent.slug) || '-general' = lower(a.lookup_slug)
      )
    order by case when lower(child.slug) = lower(a.lookup_slug) then 0 else 1 end
    limit 1
  ) c on true
)
update public.category_keywords ck
set
  keywords = (
    select coalesce(array_agg(distinct k), ck.keywords)
    from unnest(ck.keywords || r.extra) as k
  ),
  updated_at = now()
from resolved r
where ck.category_id = r.category_id
  and ck.is_active = true;
