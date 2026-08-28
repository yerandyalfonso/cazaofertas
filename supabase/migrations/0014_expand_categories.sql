-- Ampliar catálogo a 12 categorías principales.

insert into public.categories (name, slug, description, image_url, is_active)
values
  (
    'Hogar y cocina',
    'hogar',
    'Cocina, decoración, organización y electrodomésticos.',
    'https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Belleza y cuidado personal',
    'belleza',
    'Cosmética, perfumería y cuidado personal.',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Tecnología',
    'tecnologia',
    'Móviles, TV, audio, foto y gadgets.',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Informática',
    'informatica',
    'Portátiles, PC, periféricos y componentes.',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Moda',
    'moda',
    'Ropa, calzado y complementos.',
    'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Deportes y aire libre',
    'deportes',
    'Fitness, running, ciclismo y outdoor.',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Juguetes',
    'juguetes',
    'Juegos, construcción y entretenimiento infantil.',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Videojuegos',
    'videojuegos',
    'Consolas, juegos y accesorios gaming.',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Bebé y puericultura',
    'bebe',
    'Pañales, cochecitos, ropa bebé y primeros años.',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Mascotas',
    'mascotas',
    'Comida, higiene y accesorios para perros y gatos.',
    'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Jardín y exterior',
    'jardin',
    'Muebles de exterior, barbacoas, plantas y herramientas.',
    'https://images.unsplash.com/photo-1416879595882-3373a0488b5b?auto=format&fit=crop&w=1200&q=80',
    true
  ),
  (
    'Coche y moto',
    'automovil',
    'Accesorios, neumáticos y electrónica para vehículos.',
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_url = excluded.image_url,
  is_active = true;
