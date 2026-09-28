import Link from "next/link";
import {
  Baby,
  Car,
  Dumbbell,
  Gamepad2,
  Laptop,
  Package,
  PawPrint,
  PenTool,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  ToyBrick,
  type LucideIcon,
} from "lucide-react";
import type { CategoryShowcase } from "@/lib/catalog";

interface ShowcaseCategory {
  id: string;
  name: string;
  slug: string;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  belleza: Sparkles,
  moda: Shirt,
  hogar: Sofa,
  tecnologia: Smartphone,
  deportes: Dumbbell,
  juguetes: ToyBrick,
  informatica: Laptop,
  bebe: Baby,
  automovil: Car,
  videojuegos: Gamepad2,
  jardin: Sprout,
  oficina: PenTool,
  mascotas: PawPrint,
};

export function CategoryShowcaseGrid({
  categories,
  showcases,
}: {
  categories: ShowcaseCategory[];
  showcases: Map<string, CategoryShowcase>;
}) {
  // Primero las secciones con más ofertas; «Otros» siempre al final.
  const sorted = [...categories].sort((a, b) => {
    if (a.slug === "otros") return 1;
    if (b.slug === "otros") return -1;
    return (
      (showcases.get(b.slug)?.count ?? 0) - (showcases.get(a.slug)?.count ?? 0) ||
      a.name.localeCompare(b.name, "es")
    );
  });

  return (
    <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((category) => {
        const count = showcases.get(category.slug)?.count ?? 0;
        const Icon = CATEGORY_ICONS[category.slug] ?? Package;
        return (
          <li key={category.id} className="border-t border-stone-300">
            <Link
              href={`/categorias/${category.slug}`}
              className="group flex items-center gap-4 py-4"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-stone-200/70 text-stone-600 transition-colors duration-300 group-hover:bg-ink group-hover:text-paper">
                <Icon aria-hidden strokeWidth={1.4} className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-snug tracking-tight text-ink">
                  {category.name}
                </span>
                <span className="block text-sm text-stone-500">
                  {count > 0
                    ? `${count} ${count === 1 ? "oferta" : "ofertas"}`
                    : "Ver categoría"}
                </span>
              </span>
              <span
                aria-hidden
                className="text-stone-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-ink"
              >
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
