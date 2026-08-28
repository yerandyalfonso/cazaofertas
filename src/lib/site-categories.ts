export interface SiteCategoryDefinition {
  name: string;
  slug: string;
  telegramLabel: string;
  description: string;
  image_url: string;
}

/** Catálogo principal de CazaOfertas (12 categorías). */
export const SITE_CATEGORIES: SiteCategoryDefinition[] = [
  {
    name: "Hogar y cocina",
    slug: "hogar",
    telegramLabel: "Hogar",
    description: "Cocina, decoración, organización y electrodomésticos.",
    image_url:
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Belleza y cuidado personal",
    slug: "belleza",
    telegramLabel: "Belleza",
    description: "Cosmética, perfumería y cuidado personal.",
    image_url:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Tecnología",
    slug: "tecnologia",
    telegramLabel: "Electrónica",
    description: "Móviles, TV, audio, foto y gadgets.",
    image_url:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Informática",
    slug: "informatica",
    telegramLabel: "Informática",
    description: "Portátiles, PC, periféricos y componentes.",
    image_url:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Moda",
    slug: "moda",
    telegramLabel: "Moda",
    description: "Ropa, calzado y complementos.",
    image_url:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Deportes y aire libre",
    slug: "deportes",
    telegramLabel: "Deportes",
    description: "Fitness, running, ciclismo y outdoor.",
    image_url:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Juguetes",
    slug: "juguetes",
    telegramLabel: "Juguetes",
    description: "Juegos, construcción y entretenimiento infantil.",
    image_url:
      "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Videojuegos",
    slug: "videojuegos",
    telegramLabel: "Videojuegos",
    description: "Consolas, juegos y accesorios gaming.",
    image_url:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Bebé y puericultura",
    slug: "bebe",
    telegramLabel: "Bebé",
    description: "Pañales, cochecitos, ropa bebé y primeros años.",
    image_url:
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Mascotas",
    slug: "mascotas",
    telegramLabel: "Mascotas",
    description: "Comida, higiene y accesorios para perros y gatos.",
    image_url:
      "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Jardín y exterior",
    slug: "jardin",
    telegramLabel: "Jardín",
    description: "Muebles de exterior, barbacoas, plantas y herramientas.",
    image_url:
      "https://images.unsplash.com/photo-1416879595882-3373a0488b5b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Coche y moto",
    slug: "automovil",
    telegramLabel: "Coche",
    description: "Accesorios, neumáticos y electrónica para vehículos.",
    image_url:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
  },
];

export type SiteCategorySlug = (typeof SITE_CATEGORIES)[number]["slug"];

export const WIZARD_CATEGORY_OPTIONS = SITE_CATEGORIES.map((category) => ({
  label: category.telegramLabel,
  slug: category.slug,
}));
