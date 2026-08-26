"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardPaste, Copy, Wand2 } from "lucide-react";
import {
  getQuickImportTemplate,
  parseQuickImport,
  QUICK_IMPORT_TEMPLATES,
  quickImportIdForBlogTemplate,
  type QuickImportResult,
  type QuickImportTemplateId,
} from "@/lib/article-quick-import";
import type { BlogTemplate } from "@/lib/blog-templates";

interface ArticleQuickImportProps {
  activeBlogTemplate: BlogTemplate;
  onApply: (result: QuickImportResult) => void;
}

export function ArticleQuickImport({
  activeBlogTemplate,
  onApply,
}: ArticleQuickImportProps) {
  const [importTemplate, setImportTemplate] = useState<QuickImportTemplateId>(
    () => quickImportIdForBlogTemplate(activeBlogTemplate),
  );
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setImportTemplate(quickImportIdForBlogTemplate(activeBlogTemplate));
  }, [activeBlogTemplate]);

  const preset = useMemo(
    () => getQuickImportTemplate(importTemplate),
    [importTemplate],
  );

  function selectTemplate(id: QuickImportTemplateId) {
    setImportTemplate(id);
    setStatus(null);
  }

  async function copySample() {
    try {
      await navigator.clipboard.writeText(preset.sample);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatus("No se pudo copiar el ejemplo. Selecciónalo a mano.");
    }
  }

  function loadSample() {
    setDraft(preset.sample);
    setStatus("Ejemplo cargado abajo. Pulsa «Autorellenar Campos».");
  }

  function autofill() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setStatus("Pega primero el texto en el cuadro «Insertar texto» o carga el ejemplo.");
      return;
    }

    const result = parseQuickImport(trimmed, importTemplate);
    onApply(result);

    if (result.warnings.length > 0) {
      setStatus(`Campos rellenados con avisos: ${result.warnings.join(" ")}`);
    } else {
      setStatus(
        `Listo: título, extracto y ${result.blocks.length} bloque(s) aplicados (${preset.label}).`,
      );
    }
  }

  return (
    <section className="border-2 border-teal-800/40 bg-white shadow-sm">
      <div className="border-b border-teal-800/20 bg-teal-50/60 px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
          Paso 1 · Importación rápida
        </p>
        <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
          Insertar texto por plantilla
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-700">
          1) Elige plantilla → 2) Pega tu texto con etiquetas en el cuadro grande →
          3) Pulsa <span className="font-semibold">Autorellenar Campos</span>.
        </p>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Tipo de plantilla
          </p>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Tipo de plantilla de importación"
          >
            {QUICK_IMPORT_TEMPLATES.map((option) => {
              const active = importTemplate === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTemplate(option.id)}
                  className={`h-11 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
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
          <p className="mt-2 text-sm text-stone-600">{preset.description}</p>
        </div>

        <div className="border border-dashed border-teal-800/35 bg-teal-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-900">
              Formato de etiquetas · {preset.label}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copySample()}
                className="inline-flex h-8 items-center gap-1.5 border border-teal-800/30 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:border-teal-800"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copiado" : "Copiar ejemplo"}
              </button>
              <button
                type="button"
                onClick={loadSample}
                className="inline-flex h-8 items-center gap-1.5 border border-teal-800/30 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-900 hover:border-teal-800"
              >
                <ClipboardPaste className="h-3 w-3" />
                Cargar ejemplo en el cuadro
              </button>
            </div>
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-stone-800">
            {preset.guideLines.join("\n")}
          </pre>
        </div>

        <div className="rounded-sm border-2 border-ink bg-paper p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-xl tracking-tight text-ink">
                Insertar texto
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Pega aquí el borrador completo con etiquetas{" "}
                <code className="rounded bg-stone-100 px-1">[TÍTULO]</code>,{" "}
                <code className="rounded bg-stone-100 px-1">[EXTRACTO]</code>,{" "}
                <code className="rounded bg-stone-100 px-1">[IMAGEN]</code>,{" "}
                <code className="rounded bg-stone-100 px-1">[IMAGEN PRINCIPAL]</code>,
                etc.
              </p>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              {draft.trim() ? `${draft.trim().split(/\s+/).length} palabras` : "Vacío"}
            </p>
          </div>

          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setStatus(null);
            }}
            rows={14}
            spellCheck
            aria-label="Insertar texto del artículo"
            placeholder={`Pega aquí tu texto, por ejemplo:\n\n${preset.guideLines.slice(0, 8).join("\n")}`}
            className="mt-3 w-full resize-y border border-stone-400 bg-white px-3 py-3 font-mono text-sm leading-relaxed text-ink outline-none focus:border-ink focus:ring-2 focus:ring-teal-700/20"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={autofill}
              className="inline-flex h-12 items-center gap-2 bg-teal-800 px-6 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-teal-900"
            >
              <Wand2 className="h-4 w-4" />
              Autorellenar Campos
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setStatus(null);
              }}
              className="h-12 border border-stone-300 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 hover:border-ink"
            >
              Limpiar cuadro
            </button>
          </div>
        </div>

        {status ? (
          <p className="border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
