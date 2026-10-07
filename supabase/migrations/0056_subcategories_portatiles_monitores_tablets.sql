-- Subcategorías Portátiles y Monitores (Informática) y Tablets (Tecnología).
-- Antes: portátiles en «Informática › General», monitores en «General» o
-- «Periféricos y componentes» y tablets en «Tecnología › Electrónica».
-- 1) crea las subcategorías, 2) les mueve keywords y patrones de migas,
-- 3) reclasifica los productos existentes por título (sin accesorios).

begin;

insert into public.categories (name, slug, is_active, parent_id)
select v.name, v.slug, true, p.id
from (values
  ('informatica', 'informatica-portatiles', 'Portátiles'),
  ('informatica', 'informatica-monitores', 'Monitores'),
  ('tecnologia', 'tecnologia-tablets', 'Tablets')
) as v(parent_slug, slug, name)
join public.categories p on p.slug = v.parent_slug and p.parent_id is null
where not exists (
  select 1 from public.categories x where x.parent_id = p.id and x.slug = v.slug
);

-- Grupos de inferencia de las subcategorías nuevas.
insert into public.category_keywords (category_id, keywords, breadcrumb_patterns, is_active, notes)
select c.id, v.keywords, v.patterns, true, 'migration:0056'
from (values
  ('informatica-portatiles',
   array['portatil', 'laptop', 'notebook', 'chromebook', 'macbook', 'portatil gaming', 'ultrabook', 'portatil barato', 'portatil 15 pulgadas', 'portatil 17 pulgadas', 'ordenador portatil', 'pc portatil', 'portatil convertible']::text[],
   array['\bportatiles?\b', '\blaptops?\b', '\bnotebooks?\b']::text[]),
  ('informatica-monitores',
   array['monitor', 'monitor gaming', 'monitor curvo', 'monitor portatil', 'monitor 4k', 'monitor 27 pulgadas', 'monitor 24 pulgadas', 'monitor ultrawide', 'pantalla pc']::text[],
   array['\bmonitores?\b']::text[]),
  ('tecnologia-tablets',
   array['tablet', 'tableta', 'ipad', 'galaxy tab', 'lenovo tab', 'redmi pad', 'xiaomi pad', 'matepad', 'tablet android', 'tablet niños']::text[],
   array['\btablets?\b', '\btabletas?\b']::text[])
) as v(slug, keywords, patterns)
join public.categories c on c.slug = v.slug
where not exists (
  select 1 from public.category_keywords k where k.category_id = c.id
);

-- Quitar esas keywords/patrones de los grupos de donde salen.
update public.category_keywords k
set keywords = array(
      select kw from unnest(k.keywords) kw
      where kw not in ('portatil', 'laptop', 'notebook', 'chromebook', 'macbook', 'portatil gaming', 'ultrabook', 'portatil barato', 'portatil 15 pulgadas', 'portatil 17 pulgadas')
    ),
    breadcrumb_patterns = array(
      select p from unnest(k.breadcrumb_patterns) p
      where p not in ('\blaptops\b', '\bportatiles?\b')
    )
from public.categories c
join public.categories parent on parent.id = c.parent_id
where k.category_id = c.id and c.slug = 'general' and parent.slug = 'informatica';

update public.category_keywords k
set keywords = array(select kw from unnest(k.keywords) kw where kw <> 'monitor')
from public.categories c
where k.category_id = c.id and c.slug = 'informatica-perifericos';

update public.category_keywords k
set keywords = array(select kw from unnest(k.keywords) kw where kw not in ('tablet', 'tableta', 'ipad')),
    breadcrumb_patterns = array(select p from unnest(k.breadcrumb_patterns) p where p <> '\btablets?\b')
from public.categories c
where k.category_id = c.id and c.slug = 'tecnologia-electronica';

-- Reclasificación de productos existentes (todas las tiendas).
create function pg_temp.is_accessory(t text) returns boolean language sql immutable as $$
  select t ~* '\y(soporte|brazo|backpack|mochila|funda para|estaci[oó]n de acoplamiento|hub|docking|l[aá]piz|pencil|combo touch|teclado para|keyboard|controlador|mando|power bank|bater[ií]a externa|protector|cargador|cable|adaptador|limpiador|l[aá]mpara|barra de luz|alfombrilla|all in one|todo en uno|para (el )?(port[aá]til|portatiles|laptop|monitor|monitores|tablet|ipad|macbook))\y'
$$;

create function pg_temp.kind(t text) returns text language sql immutable as $$
  select case
    when t ~* '^\s*(ordenador\s+)?port[aá]til\y' then 'informatica-portatiles'
    when t ~* '^\s*monitor\y' then 'informatica-monitores'
    when t ~* '^\s*(tablet|tableta)\y' then 'tecnologia-tablets'
    when pg_temp.is_accessory(t) then null
    when t ~* '\ymonitor port[aá]til\y' then 'informatica-monitores'
    when t ~* '(\y(ordenador|pc) port[aá]til\y|\ylaptop\y|\ymacbook\y|\ychromebook\y|\yultrabook\y|\yport[aá]til (gaming|hp|lenovo|asus|acer|msi|dell|apple|huawei|medion|samsung|lg)\y)' then 'informatica-portatiles'
    when t ~* '(\ymonitor (gaming|curvo|pc|\d)|\y(msi|lg|samsung|aoc|philips|benq|asus|acer|dell|xiaomi|hp|lenovo|gigabyte|iiyama|koorui|viewsonic) [^,]*\d{2}(\.\d)?"\s*(led|ips|va|oled|qd|fast|nano|mini))' then 'informatica-monitores'
    when t ~* '(\ytablet (samsung|lenovo|xiaomi|apple|huawei|android|teclast|doogee|blackview|oukitel)\y|\yipad\y|\ygalaxy tab\y|\ylenovo tab\y|\yredmi pad\y|\yxiaomi pad\y|\ymatepad\y|\ytablet android\y)' then 'tecnologia-tablets'
  end
$$;

with source_cats as (
  select c.id, c.slug, parent.slug as parent_slug
  from public.categories c
  join public.categories parent on parent.id = c.parent_id
  where (parent.slug = 'informatica' and c.slug in ('general', 'informatica-perifericos'))
     or c.slug = 'tecnologia-electronica'
),
moves as (
  select p.id as product_id, pg_temp.kind(p.title) as target_slug, s.parent_slug
  from public.products p
  join source_cats s on s.id = p.category_id
)
update public.products p
set category_id = target.id
from moves m
join public.categories target on target.slug = m.target_slug
where p.id = m.product_id
  and (
    (m.target_slug in ('informatica-portatiles', 'informatica-monitores') and m.parent_slug = 'informatica')
    or (m.target_slug = 'tecnologia-tablets' and m.parent_slug = 'tecnologia')
  );

commit;
