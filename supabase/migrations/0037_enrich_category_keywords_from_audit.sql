-- Amplía keywords a partir de títulos reales mal clasificados (audit 2026-09).
-- Idempotente: solo añade keywords que aún no estén en el array.

with additions(lookup_slug, extra) as (
  values
  ('bebe-bebes', array[
    'barrera seguridad', 'barrera niños', 'torre aprendizaje', 'torre de aprendizaje',
    'portabebe', 'portabebé', 'cojin lactancia', 'cojín lactancia', 'almohada embarazada',
    'saco bebe', 'saco para bebe', 'saco para bebé', 'taburete cintura bebe'
  ]::text[]),
  ('bebe-ninos', array[
    'karaoke infantil', 'microfono infantil', 'regalo niña', 'regalo niño'
  ]::text[]),
  ('belleza-salud', array[
    'andador', 'andadores', 'andador ancianos', 'andador adultos', 'baston ancianos'
  ]::text[]),
  ('deportes-aire-libre', array[
    'overgrip', 'grip padel', 'grip pádel', 'wilson pro', 'pala padel', 'pala pádel',
    'pelotas padel', 'pelotas tenis'
  ]::text[]),
  ('hogar-cocina', array[
    'ingenio', 'tefal', 'sartenes', 'sarten antiadherente', 'pulverizador aceite',
    'spray aceite cocina', 'cazos', 'bateria cocina'
  ]::text[]),
  ('hogar-muebles', array[
    'escritorio elevable', 'mesa elevable', 'silla ergonómica', 'silla ergonomica',
    'cabecero', 'banco zapatero'
  ]::text[]),
  ('moda-complementos', array[
    'diadema', 'diademas', 'coletero', 'scrunchie', 'horquilla pelo'
  ]::text[]),
  ('oficina-general', array[
    'escritorio elevable', 'mesa elevable oficina', 'standing desk'
  ]::text[]),
  ('videojuegos-general', array[
    'gamesir', 'mando pc', 'mando inalambrico pc', 'hyperion mando', 'nyxi',
    'mando switch', 'base carga mando'
  ]::text[]),
  ('juguetes-general', array[
    'camara fotos infantil', 'camara infantil', 'instantanea infantil',
    'bloques magneticos', 'construcciones magneticas', 'disfraz dinosaurio'
  ]::text[])
),
resolved as (
  select
    c.id as category_id,
    a.extra
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
    order by
      case when lower(child.slug) = lower(a.lookup_slug) then 0 else 1 end
    limit 1
  ) c on true
)
update public.category_keywords ck
set
  keywords = (
    select coalesce(array_agg(distinct k), ck.keywords)
    from unnest(ck.keywords || r.extra) as k
  ),
  updated_at = now(),
  notes = coalesce(ck.notes, '') || case
    when coalesce(ck.notes, '') = '' then 'enrich:audit-2026-09'
    when ck.notes like '%enrich:audit-2026-09%' then ''
    else '; enrich:audit-2026-09'
  end
from resolved r
where ck.category_id = r.category_id
  and ck.is_active = true;
