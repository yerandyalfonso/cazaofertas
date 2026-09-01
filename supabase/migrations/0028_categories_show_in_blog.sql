-- Visibilidad de categorías padre en el blog público.
alter table public.categories
  add column if not exists show_in_blog boolean not null default false;

comment on column public.categories.show_in_blog is
  'Si true, la categoría padre aparece en el blog/catálogo público.';

update public.categories
set show_in_blog = true
where parent_id is null
  and slug in (
    'bebe',
    'belleza',
    'automovil',
    'deportes',
    'hogar',
    'informatica',
    'jardin',
    'juguetes',
    'mascotas',
    'moda',
    'tecnologia',
    'videojuegos',
    'oficina',
    'otros'
  );
