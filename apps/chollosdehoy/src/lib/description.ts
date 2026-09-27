export interface DescriptionItem {
  /** Rótulo del punto («Batería de 1200 mAh»), si el texto lo trae. */
  title: string | null;
  text: string;
}

/** «4 MODOS Y CONTROL DE 20 NIVELES» → «4 modos y control de 20 niveles». */
function calmShouting(value: string): string {
  const letters = value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length < 4 || letters !== letters.toUpperCase()) return value;
  const lower = value.toLocaleLowerCase("es-ES");
  const firstLetter = lower.search(/[a-záéíóúüñ0-9]/);
  if (firstLetter < 0 || /[0-9]/.test(lower.charAt(firstLetter))) return lower;
  return (
    lower.slice(0, firstLetter) +
    lower.charAt(firstLetter).toLocaleUpperCase("es-ES") +
    lower.slice(firstLetter + 1)
  );
}

/**
 * Convierte la descripción guardada (párrafos separados por líneas en blanco,
 * al estilo de las viñetas de Amazon) en puntos con rótulo opcional:
 * «BATERÍA 1200MAH: Este extractor…» → { title: "Batería 1200mah", text: "Este extractor…" }.
 */
export function parseProductDescription(raw: string | null): DescriptionItem[] {
  if (!raw?.trim()) return [];

  const blocks = /\n\s*\n/.test(raw) ? raw.split(/\n\s*\n/) : raw.split(/\n/);
  const items: DescriptionItem[] = [];

  for (const block of blocks) {
    const clean = block.replace(/\s+/g, " ").trim();
    if (!clean) continue;

    // Rótulo corto seguido de «:» o « - » al principio del párrafo.
    const match = clean.match(/^(.{3,70}?)\s*(?::|\s[-–]\s)\s*(.{12,})$/);
    if (match && !/[.!?]/.test(match[1]!)) {
      const text = calmShouting(match[2]!.trim());
      items.push({
        title: calmShouting(match[1]!.trim()),
        text: text.charAt(0).toLocaleUpperCase("es-ES") + text.slice(1),
      });
    } else {
      items.push({ title: null, text: calmShouting(clean) });
    }
  }

  return items;
}
