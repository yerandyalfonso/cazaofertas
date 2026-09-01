"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  ARTICLE_TEMPLATE_OPTIONS,
  getTemplateStyleOutline,
} from "@/lib/admin-article-editor";
import type { BlogTemplate } from "@/lib/blog-templates";

/**
 * Guía estática de consulta: el redactor puede copiar la estructura
 * fuera del panel sin parsear JSON ni precargar el editor.
 */
export function ArticleStyleGuide({
  activeTemplate,
}: {
  activeTemplate: BlogTemplate;
}) {
  const [open, setOpen] = useState(false);
  const [focusTemplate, setFocusTemplate] =
    useState<BlogTemplate>(activeTemplate);

  useEffect(() => {
    setFocusTemplate(activeTemplate);
  }, [activeTemplate]);

  const outline = getTemplateStyleOutline(focusTemplate);

  return (
    <section className="admin-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
            Consulta
          </p>
          <p className="mt-1 font-display text-xl tracking-tight text-ink">
            Guía de Estilo y Formato de Artículo
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Estructura de ejemplo recomendada para redactar fuera del panel y
            rellenar los campos a mano.
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-stone-500 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-6 border-t border-stone-200 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Formato estándar (todos los artículos)
            </p>
            <ul className="mt-3 space-y-2 text-sm text-stone-700">
              <li>
                <span className="font-semibold text-ink">Título:</span> claro,
                con intención de búsqueda (producto + beneficio o momento de
                compra).
              </li>
              <li>
                <span className="font-semibold text-ink">Extracto:</span> 1–2
                frases con la promesa del artículo (aparece en listados y SEO).
              </li>
              <li>
                <span className="font-semibold text-ink">Pull-quote:</span> frase
                editorial corta opcional para la cabecera.
              </li>
              <li>
                <span className="font-semibold text-ink">Bloques:</span> títulos
                H2/H3/H4, párrafos, listas, citas y bloques especiales en el
                editor visual. Al guardar se convierten a bloques tipados. Enlaza
                productos con el selector del formulario.
              </li>
              <li>
                <span className="font-semibold text-ink">SEO:</span> título y
                descripción opcionales; si se dejan vacíos, se usan título y
                extracto.
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Estructura por plantilla
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ARTICLE_TEMPLATE_OPTIONS.map((option) => {
                const active = focusTemplate === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFocusTemplate(option.id)}
                    className={`h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      active
                        ? "bg-ink text-paper"
                        : "border border-stone-300 bg-stone-50 text-stone-600 hover:border-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 admin-card bg-[var(--surface-muted)]/80 p-4">
              <p className="font-display text-lg tracking-tight text-ink">
                {outline.label}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Categoría sugerida: {outline.category}
              </p>
              {outline.pullQuoteExample ? (
                <p className="mt-3 border-l-2 border-teal-700/50 pl-3 font-display text-base text-stone-700">
                  “{outline.pullQuoteExample}”
                </p>
              ) : null}

              <ol className="mt-4 space-y-3">
                {outline.sections.map((section, index) => (
                  <li
                    key={`${section.kind}-${index}`}
                    className="flex gap-3 text-sm"
                  >
                    <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800">
                      {section.kind}
                    </span>
                    <span className="text-stone-700">{section.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-stone-500">
            Esta guía es solo de referencia. No modifica el formulario: copia la
            estructura en tu borrador externo y rellena título, extracto y
            bloques aquí de forma directa.
          </p>
        </div>
      ) : null}
    </section>
  );
}
