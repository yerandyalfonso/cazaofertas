-- Subcategoría catch-all "general" bajo cada padre (URL /categorias/moda/general).
-- Permite slug "general" repetido entre padres vía (parent_id, slug).

alter table public.categories drop constraint if exists categories_slug_key;

create unique index if not exists categories_root_slug_key
  on public.categories (slug)
  where parent_id is null;

create unique index if not exists categories_child_parent_slug_key
  on public.categories (parent_id, slug)
  where parent_id is not null;

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('belleza-belleza'),
      ('belleza-general'),
      ('deportes-deportes'),
      ('deportes-general'),
      ('hogar-hogar'),
      ('hogar-general'),
      ('informatica-informatica'),
      ('informatica-general'),
      ('jardin-jardin'),
      ('jardin-general'),
      ('juguetes-juguetes'),
      ('juguetes-general'),
      ('mascotas-mascotas'),
      ('mascotas-general'),
      ('moda-moda'),
      ('moda-general'),
      ('videojuegos-videojuegos'),
      ('videojuegos-general'),
      ('oficina-oficina'),
      ('oficina-general'),
      ('otros-general')
    ) as t(old_slug)
  loop
    update public.categories
    set
      slug = 'general',
      name = 'General',
      description = 'Productos sin subcategoría más específica'
    where slug = rec.old_slug;
  end loop;
end $$;
