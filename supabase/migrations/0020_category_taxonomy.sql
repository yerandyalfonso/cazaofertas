-- Jerarquía de categorías: 14 padres (blog) + subcategorías internas.

alter table public.categories
  add column if not exists parent_id uuid references public.categories (id) on delete set null;

create index if not exists categories_parent_id_idx
  on public.categories (parent_id);

comment on column public.categories.parent_id is
  'NULL = categoría de blog (padre). Con valor = subcategoría interna (bot/Telegram).';

-- Padres (blog)
insert into public.categories (name, slug, description, image_url, is_active, parent_id)
values
  ('Bebé y puericultura', 'bebe', 'Pañales, cochecitos, ropa bebé y primeros años.', 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Belleza y cuidado personal', 'belleza', 'Cosmética, perfumería, salud y cuidado personal.', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Coche y moto', 'automovil', 'Accesorios, neumáticos y electrónica para vehículos.', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Deportes y aire libre', 'deportes', 'Fitness, running, ciclismo y outdoor.', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Hogar y cocina', 'hogar', 'Cocina, decoración, organización y electrodomésticos.', 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Informática', 'informatica', 'Portátiles, PC, periféricos y componentes.', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Jardín y exterior', 'jardin', 'Muebles de exterior, barbacoas, plantas y herramientas.', 'https://images.unsplash.com/photo-1416879595882-3373a0488b5b?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Juguetes', 'juguetes', 'Juegos, construcción y entretenimiento infantil.', 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Mascotas', 'mascotas', 'Comida, higiene y accesorios para perros y gatos.', 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Moda', 'moda', 'Ropa, calzado y complementos.', 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Tecnología', 'tecnologia', 'Móviles, TV, audio, foto y gadgets.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Videojuegos', 'videojuegos', 'Consolas, juegos y entretenimiento.', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Oficina y Papelera', 'oficina', 'Material escolar, papelería y suministros de oficina.', 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', true, null),
  ('Otros', 'otros', 'Libros, viajes, supermercado y todo lo no clasificado.', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80', true, null)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = true,
  parent_id = null;

-- Subcategorías (insert dinámico vía función)
do $$
declare
  rec record;
  parent_uuid uuid;
begin
  for rec in
    select * from (values
      ('bebe', 'bebe-bebes', 'Bebés'),
      ('bebe', 'bebe-ninos', 'Niños'),
      ('belleza', 'belleza-belleza', 'Belleza'),
      ('belleza', 'belleza-cuidado-personal', 'Cuidado personal'),
      ('belleza', 'belleza-perfumes', 'Perfumes'),
      ('belleza', 'belleza-salud', 'Salud'),
      ('automovil', 'automovil-coches', 'Coches'),
      ('automovil', 'automovil-motos', 'Motos'),
      ('automovil', 'automovil-seguridad', 'Seguridad'),
      ('deportes', 'deportes-deportes', 'Deportes'),
      ('deportes', 'deportes-aire-libre', 'Aire libre'),
      ('deportes', 'deportes-camping', 'Camping'),
      ('deportes', 'deportes-movilidad', 'Movilidad'),
      ('hogar', 'hogar-hogar', 'Hogar'),
      ('hogar', 'hogar-cocina', 'Cocina'),
      ('hogar', 'hogar-bano', 'Baño'),
      ('hogar', 'hogar-climatizacion', 'Climatización'),
      ('hogar', 'hogar-decoracion', 'Decoración'),
      ('hogar', 'hogar-descanso', 'Descanso'),
      ('hogar', 'hogar-electrodomesticos', 'Electrodomésticos'),
      ('hogar', 'hogar-iluminacion', 'Iluminación'),
      ('hogar', 'hogar-limpieza', 'Limpieza'),
      ('hogar', 'hogar-muebles', 'Muebles'),
      ('hogar', 'hogar-bricolaje', 'Bricolaje'),
      ('hogar', 'hogar-herramientas', 'Herramientas'),
      ('hogar', 'hogar-ventilacion', 'Ventilación'),
      ('informatica', 'informatica-informatica', 'Informática'),
      ('informatica', 'informatica-perifericos', 'Periféricos y componentes'),
      ('jardin', 'jardin-jardin', 'Jardín'),
      ('juguetes', 'juguetes-juguetes', 'Juguetes'),
      ('juguetes', 'juguetes-manualidades', 'Manualidades'),
      ('juguetes', 'juguetes-modelismo', 'Modelismo'),
      ('mascotas', 'mascotas-mascotas', 'Mascotas'),
      ('moda', 'moda-moda', 'Moda'),
      ('moda', 'moda-calzado', 'Calzado'),
      ('moda', 'moda-bolsos-mujer', 'Bolsos de mujer'),
      ('moda', 'moda-complementos', 'Complementos de ropa'),
      ('moda', 'moda-joyeria', 'Joyería'),
      ('moda', 'moda-relojes', 'Relojes'),
      ('moda', 'moda-equipaje', 'Equipaje'),
      ('tecnologia', 'tecnologia-electronica', 'Electrónica'),
      ('tecnologia', 'tecnologia-moviles', 'Móviles'),
      ('tecnologia', 'tecnologia-audio', 'Audio'),
      ('tecnologia', 'tecnologia-hifi', 'Sonido HI-FI'),
      ('tecnologia', 'tecnologia-fotografia', 'Fotografía'),
      ('tecnologia', 'tecnologia-televisores', 'Televisores'),
      ('tecnologia', 'tecnologia-accesorios-movil', 'Accesorios para móvil'),
      ('videojuegos', 'videojuegos-videojuegos', 'Videojuegos'),
      ('videojuegos', 'videojuegos-entretenimiento', 'Entretenimiento'),
      ('oficina', 'oficina-material-escolar', 'Material escolar'),
      ('oficina', 'oficina-papelera', 'Papelera'),
      ('oficina', 'oficina-oficina', 'Oficina'),
      ('otros', 'otros-general', 'Otros'),
      ('otros', 'otros-actualidad', 'Actualidad'),
      ('otros', 'otros-cupones', 'Códigos de descuento'),
      ('otros', 'otros-supermercado', 'Supermercado'),
      ('otros', 'otros-libros', 'Libros'),
      ('otros', 'otros-musica', 'Música'),
      ('otros', 'otros-cine', 'Cine'),
      ('otros', 'otros-viajes', 'Viajes')
    ) as t(parent_slug, slug, name)
  loop
    select id into parent_uuid from public.categories where slug = rec.parent_slug limit 1;
    if parent_uuid is null then
      continue;
    end if;
    insert into public.categories (name, slug, description, is_active, parent_id)
    values (rec.name, rec.slug, rec.name, true, parent_uuid)
    on conflict (slug) do update set
      name = excluded.name,
      is_active = true,
      parent_id = excluded.parent_id;
  end loop;
end $$;

-- Productos que apuntaban a un padre → subcategoría por defecto del padre.
update public.products p
set category_id = sub.id
from public.categories parent
join public.categories sub on sub.parent_id = parent.id
where p.category_id = parent.id
  and parent.parent_id is null
  and sub.slug = case parent.slug
    when 'bebe' then 'bebe-bebes'
    when 'belleza' then 'belleza-belleza'
    when 'automovil' then 'automovil-coches'
    when 'deportes' then 'deportes-deportes'
    when 'hogar' then 'hogar-hogar'
    when 'informatica' then 'informatica-informatica'
    when 'jardin' then 'jardin-jardin'
    when 'juguetes' then 'juguetes-juguetes'
    when 'mascotas' then 'mascotas-mascotas'
    when 'moda' then 'moda-moda'
    when 'tecnologia' then 'tecnologia-electronica'
    when 'videojuegos' then 'videojuegos-videojuegos'
    when 'oficina' then 'oficina-oficina'
    when 'otros' then 'otros-general'
    else sub.slug
  end;

-- Sin categoría → otros-general.
update public.products p
set category_id = sub.id
from public.categories sub
where p.category_id is null
  and sub.slug = 'otros-general';
