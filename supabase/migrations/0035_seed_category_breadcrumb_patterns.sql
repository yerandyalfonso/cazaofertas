-- Seed breadcrumb_patterns from static inference rules (~60 grupos).
-- Requiere 0034. Actualiza filas existentes; inserta grupo vacío de keywords si falta.

with seed(lookup_slug, breadcrumb_patterns) as (
  values
  ('automovil-coches', array['\bcoche\b', '\bautomovil\b', '\bneumaticos?\b', '\bcoches\b', '\bacc. coche\b', '\bpiezas de coche\b']::text[]),
  ('automovil-motos', array['\bmotos?\b', '\bcascos?\s+moto\b', '\bmotos\b', '\bmotocicletas\b', '\bacc. moto\b', '\bcascos moto\b']::text[]),
  ('automovil-seguridad', array['\bseguridad\b', '\bsillas?\s+de\s+coche\b', '\bseguridad vehiculo\b', '\balarma coche\b', '\bgps coche\b']::text[]),
  ('bebe-bebes', array['\bbebe\b', '\bpuericultura\b', '\bbebes\b', '\blactancia\b', '\bpanales\b', '\bcochecitos\b', '\bchupetes\b', '\bbiberones\b']::text[]),
  ('bebe-ninos', array['\bniños?\b', '\binfantil\b', '\bninos\b', '\bmoda infantil\b', '\bjunior\b']::text[]),
  ('belleza-cuidado-personal', array['\bcuidado\s+personal\b', '\bafeitad', '\bcuidado personal\b', '\bhigiene\b', '\bdepilacion\b', '\bcuidado cabello\b', '\bafeitado\b']::text[]),
  ('belleza-general', array['\bcosmetica\b', '\bmaquillaje\b', '\bcuidado\s+de\s+la\s+piel\b', '\bbelleza\b', '\bcuidado facial\b']::text[]),
  ('belleza-perfumes', array['\bperfumes?\b', '\bfragancias?\b', '\bperfumes\b', '\bfragancias\b', '\bcolonias\b', '\bperfumeria\b']::text[]),
  ('belleza-salud', array['\bsalud\b', '\bfarmacia\b', '\bvitaminas?\b', '\bsuplementos?\b', '\bnutricion\s+deportiva\b', '\bparafarmacia\b', '\bortopedia\b']::text[]),
  ('deportes-aire-libre', array['\baire\s+libre\b', '\btrekking\b', '\baire libre\b', '\boutdoor\b', '\bsenderismo\b', '\bmontana\b']::text[]),
  ('deportes-camping', array['\bcamping\b', '\btiendas?\s+de\s+campa', '\bacampada\b', '\bcaravaning\b']::text[]),
  ('deportes-general', array['\bfitness\b', '\bgimnasio\b', '\bmusculacion\b', '\bdeportes\b', '\bentrenamiento\b']::text[]),
  ('deportes-movilidad', array['\bpatinetes?\b', '\belectricos?\b', '\bmovilidad urbana\b', '\bpatinetes electricos\b', '\bpatinetes\b', '\bbicicletas\b']::text[]),
  ('hogar-bano', array['\bbaño\b', '\bbano\b', '\bbanos\b', '\btextil de bano\b', '\bsancitario bano\b']::text[]),
  ('hogar-bricolaje', array['\bbricolaje\b', '\bherramientas?\b', '\bferreteria\b', '\bherramientas electricas\b']::text[]),
  ('hogar-climatizacion', array['\bclimatizacion\b', '\bcalefaccion\b', '\btratamiento de aire\b']::text[]),
  ('hogar-cocina', array['\bcocina\b', '\bmenaje\b', '\butensilios de cocina\b', '\breposteria\b']::text[]),
  ('hogar-decoracion', array['\bdecoracion\b', '\binteriorismo\b']::text[]),
  ('hogar-descanso', array['\bdescanso\b', '\bcolchones?\b', '\bcolchones\b', '\bdormitorio\b', '\bcama\b']::text[]),
  ('hogar-electrodomesticos', array['\belectrodomesticos?\b', '\bfrigorificos?\b', '\belectrodomesticos\b', '\belectrodomesticos gran linea\b', '\belectrodomesticos cocina\b']::text[]),
  ('hogar-general', array['\bhogar\b', '\bcasa y cocina\b', '\bordenacion\b']::text[]),
  ('hogar-herramientas', array['\bherramientas\b', '\bherramientas manuales\b']::text[]),
  ('hogar-iluminacion', array['\biluminacion\b', '\blamparas?\b', '\blamparas\b', '\biluminacion led\b']::text[]),
  ('hogar-limpieza', array['\blimpieza\b', '\baspirador', '\blimpieza hogar\b', '\baspiradoras\b', '\bproductos de limpieza\b']::text[]),
  ('hogar-muebles', array['\bmuebles?\b', '\bsofas?\b', '\bmuebles\b', '\bmobiliario\b', '\bmuebles hogar\b']::text[]),
  ('hogar-ventilacion', array['\bventilacion\b', '\bventiladores\b', '\bventilacion techo\b']::text[]),
  ('informatica-general', array['\bportatiles?\b', '\bordenadores?\b', '\binformatica\b', '\blaptops\b', '\bordenadores\b', '\bpcs\b']::text[]),
  ('informatica-perifericos', array['\bperifericos?\b', '\bcomponentes?\b', '\bperifericos\b', '\bcomponentes pc\b', '\bhardware\b']::text[]),
  ('jardin-general', array['\bjardin\b', '\bjardineria\b', '\bexterior\b', '\bterraza y jardin\b', '\bplantas y macetas\b']::text[]),
  ('juguetes-general', array['\bjuguetes?\b', '\bjuguetes\b', '\bjuegos de mesa\b', '\bjuguetes infantiles\b']::text[]),
  ('juguetes-manualidades', array['\bmanualidades?\b', '\barte\s+y\s+manualidades\b', '\bmanualidades\b', '\barts and crafts\b', '\bbricolaje infantil\b']::text[]),
  ('juguetes-modelismo', array['\bmodelismo\b', '\bmaquetas\b', '\bmodelos escala\b']::text[]),
  ('mascotas-general', array['\bmascotas?\b', '\bperros?\b', '\bgatos?\b', '\bmascotas\b', '\bperros y gatos\b', '\banimales\b']::text[]),
  ('moda-bolsos-mujer', array['\bbolsos?\b', '\bbandoleras?\b', '\bbolsos\b', '\bcarteras mujer\b', '\bbolsos de mano\b']::text[]),
  ('moda-calzado', array['\bzapatos?\b', '\bcalzado\b', '\bzapatos\b', '\bcalzado hombre mujer\b']::text[]),
  ('moda-complementos', array['\bcomplementos?\b', '\bcinturones?\b', '\bcomplementos\b', '\baccesorios moda\b', '\bcomplementos moda\b']::text[]),
  ('moda-equipaje', array['\bequipaje\b', '\bmaletas?\b', '\bmaletas\b', '\bbolsas de viaje\b']::text[]),
  ('moda-general', array['\bmoda\b', '\bropa\b', '\bvestimenta\b', '\btextil moda\b']::text[]),
  ('moda-joyeria', array['\bjoyeria\b', '\bbisuteria\b', '\bjoyas\b']::text[]),
  ('moda-relojes', array['\brelojes?\b', '\brelojes\b', '\breloj\b', '\bsmartwatches\b']::text[]),
  ('oficina-general', array['\boficina\b', '\bsuministros oficina\b', '\bequipamiento oficina\b']::text[]),
  ('oficina-material-escolar', array['\bmaterial\s+escolar\b', '\bestuches?\b', '\bmaterial escolar\b', '\bvuelta al cole\b', '\bcolegio\b']::text[]),
  ('oficina-papelera', array['\bimpr(?:esoras?|esion)\b', '\bpapeleria\b', '\bpapelera\b', '\bpapel\b', '\bproductos de papel\b']::text[]),
  ('otros-actualidad', array['\bnoticias\b', '\bactualidad\b', '\bnovedades\b']::text[]),
  ('otros-cine', array['\bcine\b', '\bpeliculas?\b', '\bpeliculas\b', '\bseries tv\b']::text[]),
  ('otros-cupones', array['\bcupones?\b', '\bcodigos?\s+descuento\b', '\bcodigos de descuento\b', '\bcupones\b']::text[]),
  ('otros-general', array['\botros\b', '\bvarios\b', '\bgeneral\b']::text[]),
  ('otros-libros', array['\blibros?\b', '\be-?books?\b', '\blibros\b', '\bliteratura\b', '\breading\b']::text[]),
  ('otros-musica', array['\bmusica\b', '\bvinilos?\b', '\bcd y vinilos\b', '\baudio musica\b']::text[]),
  ('otros-supermercado', array['\bsupermercado\b', '\balimentacion\b', '\balimentacion y bebidas\b', '\bgourmet\b']::text[]),
  ('otros-viajes', array['\bviajes?\b', '\bvuelos?\b', '\bviajes\b', '\bequipaje de mano\b', '\baccesorios viaje\b']::text[]),
  ('tecnologia-accesorios-movil', array['\baccesorios?\s+(para\s+)?movil', '\baccesorios movil\b', '\bfundas moviles\b', '\bcargadores movil\b']::text[]),
  ('tecnologia-audio', array['\baudio\b', '\bsonido\b', '\baltavoces\b', '\bauriculares\b']::text[]),
  ('tecnologia-electronica', array['\btablets?\b', '\belectronica\b', '\bgadgets\b', '\belectronica consumo\b']::text[]),
  ('tecnologia-fotografia', array['\bfoto(grafia)?\b', '\bcamaras?\b', '\bfotografia\b', '\bcamaras\b', '\bvideo y foto\b']::text[]),
  ('tecnologia-hifi', array['\bsonido hi-fi\b', '\bhi-fi\b', '\baudio hifi\b']::text[]),
  ('tecnologia-moviles', array['\bmoviles?\b', '\btelefonos?\b', '\bsmartphones?\b', '\bmoviles\b', '\bsmartphones\b', '\btelefonia\b']::text[]),
  ('tecnologia-televisores', array['\btelevisores?\b', '\btv\b', '\btelevisores\b', '\btv y video\b', '\bpantallas tv\b']::text[]),
  ('videojuegos-entretenimiento', array['\bentretenimiento\b', '\bstreaming\b', '\bmerchandising\b', '\bcoleccionismo\b']::text[]),
  ('videojuegos-general', array['\bconsolas?\b', '\bplaystation\b', '\bxbox\b', '\bvideojuegos\b', '\bgaming\b', '\bconsolas\b']::text[])
),
resolved as (
  select
    c.id as category_id,
    s.breadcrumb_patterns
  from seed s
  join lateral (
    select child.id
    from public.categories child
    join public.categories parent on parent.id = child.parent_id
    where
      lower(child.slug) = lower(s.lookup_slug)
      or (
        lower(child.slug) = 'general'
        and lower(parent.slug) || '-general' = lower(s.lookup_slug)
      )
    order by
      case when lower(child.slug) = lower(s.lookup_slug) then 0 else 1 end
    limit 1
  ) c on true
)
insert into public.category_keywords (
  category_id,
  keywords,
  breadcrumb_patterns,
  is_active,
  notes
)
select
  r.category_id,
  '{}'::text[],
  r.breadcrumb_patterns,
  true,
  'seed:static-breadcrumbs'
from resolved r
on conflict (category_id) do update set
  breadcrumb_patterns = (
    select coalesce(array_agg(distinct x order by x), '{}'::text[])
    from unnest(
      public.category_keywords.breadcrumb_patterns || excluded.breadcrumb_patterns
    ) as x
  ),
  updated_at = now();
