"use client";

import { useMemo, useState } from "react";
import { Droplet, Loader2, Pipette } from "lucide-react";
import { themeFromTone } from "@/components/admin/SocialCardPreview";
import type {
  SocialCardFormatId,
  SocialCardImageFit,
  SocialCardLayoutId,
  SocialCardStyleId,
  PulseThemeId,
} from "@/lib/social-card-projects";
import { PULSE_THEME_IDS, PULSE_THEMES } from "@/lib/pulse-themes";

export interface SocialCardStyleFields {
  layoutId: SocialCardLayoutId;
  formatId: SocialCardFormatId;
  styleId: SocialCardStyleId;
  colorTone: number;
  pulseThemeId: PulseThemeId;
  imageFit: SocialCardImageFit;
  imagePadX: number;
  imagePadY: number;
  cardRadius: number;
  cardSurfaceColor: string;
  floatRotate: number;
  floatOffsetX: number;
  floatOffsetY: number;
  floatZoom: number;
  textPadX: number;
  textPadY: number;
}

export const SOCIAL_STYLE_PRESET_TONE: Record<SocialCardStyleId, number> = {
  cream: 8,
  border: 38,
  sunset: 58,
  pastel: 86,
};

const LAYOUTS: Array<{ id: SocialCardLayoutId; label: string; hint: string }> = [
  {
    id: "pulse",
    label: "Alerta YIR",
    hint: "Plantilla Figma naranja · Facebook / Instagram.",
  },
  {
    id: "minimal",
    label: "Minimalista",
    hint: "Imagen arriba, texto abajo.",
  },
  {
    id: "float",
    label: "Flotante Asimétrico",
    hint: "Imagen inclinada sobre el panel de texto.",
  },
  {
    id: "banner",
    label: "Header Banner",
    hint: "Franja superior con marca / categoría.",
  },
  {
    id: "seal",
    label: "Sello Geométrico",
    hint: "Badge de descuento grande.",
  },
];

const FORMATS: Array<{
  id: SocialCardFormatId;
  label: string;
  ratio: string;
  hint: string;
  width: number;
  height: number;
}> = [
  {
    id: "square",
    label: "Cuadrado",
    ratio: "1:1",
    hint: "Facebook Feed · Instagram Feed",
    width: 1080,
    height: 1080,
  },
  {
    id: "story",
    label: "Vertical",
    ratio: "9:16",
    hint: "Instagram Stories / Reels · Facebook Stories",
    width: 1080,
    height: 1920,
  },
  {
    id: "landscape",
    label: "Horizontal",
    ratio: "16:9",
    hint: "Twitter / YouTube / Banners",
    width: 1920,
    height: 1080,
  },
  {
    id: "classic",
    label: "Clásico",
    ratio: "4:3",
    hint: "Posts / Carruseles",
    width: 1080,
    height: 810,
  },
];

const STYLES: Array<{ id: SocialCardStyleId; label: string; hint: string }> = [
  { id: "cream", label: "Soft Cream", hint: "Coral / melocotón cálido." },
  { id: "border", label: "Border", hint: "Pasteles ámbar, rosa, cielo." },
  { id: "sunset", label: "Sunset", hint: "Naranja y violeta difuso." },
  { id: "pastel", label: "Soft Pastel", hint: "Melocotón a lavanda." },
];

const IMAGE_FITS: Array<{
  id: SocialCardImageFit;
  label: string;
  hint: string;
}> = [
  { id: "contain", label: "Contain", hint: "Imagen completa + fondo." },
  { id: "cover", label: "Cover", hint: "Rellena y recorta al centro." },
  { id: "cover-top", label: "Cover top", hint: "Rellena priorizando arriba." },
  { id: "blur", label: "Blur fill", hint: "Foto + fondo difuminado." },
  { id: "smart", label: "Smart", hint: "Cover si encaja; si no, blur." },
];

const PAD_PRESETS = [0, 24, 40, 56, 72, 96];
const TEXT_PAD_X_PRESETS = [24, 36, 44, 56, 72, 96];
const TEXT_PAD_Y_PRESETS = [16, 24, 32, 40, 56, 72];
const RADIUS_PRESETS = [0, 16, 24, 32, 40, 56, 72];

function toneLabel(tone: number): string {
  if (tone < 34) return "Normal";
  if (tone < 67) return "Vibrante";
  return "Pastel";
}

function toneHueDegrees(tone: number): number {
  const t = Math.min(100, Math.max(0, tone)) / 100;
  const band = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
  const local =
    band === 0 ? t * 3 : band === 1 ? (t - 1 / 3) * 3 : (t - 2 / 3) * 3;
  return Math.round((local * 360 + band * 47) % 360);
}

function ChipButton({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: React.ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-4 py-3 text-left transition ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-stone-300 bg-white text-ink hover:border-stone-500"
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      {hint ? (
        <p
          className={`mt-1 text-[11px] leading-snug ${
            active ? "text-paper/70" : "text-stone-500"
          }`}
        >
          {hint}
        </p>
      ) : null}
    </button>
  );
}

function PresetRow({
  label,
  value,
  presets,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  presets: number[];
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={`${label}-${preset}`}
            type="button"
            onClick={() => onChange(preset)}
            className={`h-9 min-w-12 border px-2.5 text-xs font-semibold transition ${
              value === preset
                ? "border-ink bg-ink text-paper"
                : "border-stone-300 bg-white text-stone-700 hover:border-ink"
            }`}
          >
            {preset}
          </button>
        ))}
        <label className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-white px-2 text-xs text-stone-600">
          Custom
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(event) =>
              onChange(
                Math.min(max, Math.max(min, Number(event.target.value) || min)),
              )
            }
            className="h-7 w-14 border border-stone-200 px-1.5 text-sm text-ink outline-none focus:border-ink"
          />
          <span className="text-stone-400">px</span>
        </label>
      </div>
    </div>
  );
}

export function SocialCardStyleControls({
  value,
  onChange,
  onNotify,
}: {
  value: SocialCardStyleFields;
  onChange: (patch: Partial<SocialCardStyleFields>) => void;
  onNotify?: (message: string) => void;
}) {
  const [pickingColor, setPickingColor] = useState(false);
  const theme = useMemo(
    () => themeFromTone(value.colorTone),
    [value.colorTone],
  );
  const toneName = toneLabel(value.colorTone);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Layout de tarjeta
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {LAYOUTS.map((item) => (
            <ChipButton
              key={item.id}
              active={item.id === value.layoutId}
              onClick={() => onChange({ layoutId: item.id })}
              title={item.label}
              hint={item.hint}
            />
          ))}
        </div>
        {value.layoutId === "pulse" ? (
          <div className="mt-4 space-y-3 border border-stone-200 bg-stone-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Color de fondo YIR
            </p>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {PULSE_THEME_IDS.map((id) => {
                const theme = PULSE_THEMES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ pulseThemeId: id })}
                    className={`flex flex-col items-center gap-2 border px-2 py-3 text-xs font-medium transition ${
                      value.pulseThemeId === id
                        ? "border-ink bg-white shadow-sm"
                        : "border-stone-200 bg-white/60 hover:border-stone-300"
                    }`}
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-black/10"
                      style={{
                        background: `linear-gradient(135deg, ${theme.fallback}, ${theme.discountBg})`,
                      }}
                      aria-hidden
                    />
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {value.layoutId === "float" ? (
          <div className="mt-4 grid gap-3 border border-stone-200 bg-stone-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <p className="sm:col-span-2 lg:col-span-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Flotante: inclinación, posición y zoom
            </p>
            <label className="text-xs text-stone-600">
              Ángulo ({value.floatRotate}°)
              <input
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={value.floatRotate}
                onChange={(event) =>
                  onChange({ floatRotate: Number(event.target.value) })
                }
                className="mt-1 w-full accent-ink"
              />
            </label>
            <label className="text-xs text-stone-600">
              Desplazamiento X ({value.floatOffsetX}px)
              <input
                type="range"
                min={-120}
                max={120}
                step={1}
                value={value.floatOffsetX}
                onChange={(event) =>
                  onChange({ floatOffsetX: Number(event.target.value) })
                }
                className="mt-1 w-full accent-ink"
              />
            </label>
            <label className="text-xs text-stone-600">
              Desplazamiento Y ({value.floatOffsetY}px)
              <input
                type="range"
                min={-80}
                max={200}
                step={1}
                value={value.floatOffsetY}
                onChange={(event) =>
                  onChange({ floatOffsetY: Number(event.target.value) })
                }
                className="mt-1 w-full accent-ink"
              />
            </label>
            <label className="text-xs text-stone-600">
              Zoom imagen ({Math.round(value.floatZoom * 100)}%)
              <input
                type="range"
                min={0.5}
                max={1.6}
                step={0.05}
                value={value.floatZoom}
                onChange={(event) =>
                  onChange({ floatZoom: Number(event.target.value) })
                }
                className="mt-1 w-full accent-ink"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Paleta / fondo (light)
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STYLES.map((item) => (
            <ChipButton
              key={item.id}
              active={
                Math.abs(value.colorTone - SOCIAL_STYLE_PRESET_TONE[item.id]) <=
                1.5
              }
              onClick={() =>
                onChange({
                  styleId: item.id,
                  colorTone: SOCIAL_STYLE_PRESET_TONE[item.id],
                })
              }
              title={item.label}
              hint={item.hint}
            />
          ))}
        </div>

        <div className="mt-4 border border-stone-200 bg-stone-50/80 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Tono del degradado
            </p>
            <p className="text-xs text-stone-600">
              {toneName} · matiz {toneHueDegrees(value.colorTone)}° ·{" "}
              {Math.round(value.colorTone)}
            </p>
          </div>
          <div
            className="mt-3 h-3 w-full border border-stone-200"
            style={{ background: theme.canvasBg }}
            aria-hidden
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value.colorTone}
            onChange={(event) => {
              const next = Number(event.target.value);
              const match = (
                Object.keys(SOCIAL_STYLE_PRESET_TONE) as SocialCardStyleId[]
              ).find(
                (id) => Math.abs(SOCIAL_STYLE_PRESET_TONE[id] - next) <= 1.5,
              );
              onChange({
                colorTone: next,
                ...(match ? { styleId: match } : {}),
              });
            }}
            className="mt-3 w-full accent-ink"
            aria-label="Tono del degradado de fondo"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-stone-400">
            <span>Normal</span>
            <span>Vibrante</span>
            <span>Pastel</span>
          </div>
        </div>

        <div className="mt-4 border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Fondo de la tarjeta
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-ink">
              <span
                className="relative h-9 w-9 overflow-hidden rounded-sm border border-stone-300"
                style={{ background: value.cardSurfaceColor }}
              >
                <input
                  type="color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(value.cardSurfaceColor)
                      ? value.cardSurfaceColor
                      : "#ffffff"
                  }
                  onChange={(event) =>
                    onChange({ cardSurfaceColor: event.target.value })
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Color de fondo de la tarjeta"
                />
              </span>
              <span className="font-mono text-xs uppercase">
                {value.cardSurfaceColor}
              </span>
            </label>
            <button
              type="button"
              disabled={pickingColor}
              onClick={async () => {
                const EyeDropperCtor = (
                  window as Window & {
                    EyeDropper?: new () => {
                      open: () => Promise<{ sRGBHex: string }>;
                    };
                  }
                ).EyeDropper;
                if (!EyeDropperCtor) {
                  onNotify?.(
                    "Tu navegador no soporta el cuentagotas. Usa Chrome/Edge.",
                  );
                  return;
                }
                setPickingColor(true);
                try {
                  const result = await new EyeDropperCtor().open();
                  onChange({ cardSurfaceColor: result.sRGBHex });
                } catch {
                  // cancelado
                } finally {
                  setPickingColor(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-sm border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-ink disabled:opacity-50"
            >
              {pickingColor ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pipette className="h-3.5 w-3.5" />
              )}
              Cuentagotas
            </button>
            <button
              type="button"
              onClick={() => onChange({ cardSurfaceColor: "#ffffff" })}
              className="inline-flex items-center gap-2 rounded-sm border border-stone-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-stone-600 hover:border-ink hover:text-ink"
            >
              <Droplet className="h-3.5 w-3.5" />
              Blanco
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Formato de exportación
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {FORMATS.map((item) => (
            <ChipButton
              key={item.id}
              active={item.id === value.formatId}
              onClick={() => onChange({ formatId: item.id })}
              title={
                <>
                  {item.label}{" "}
                  <span className="opacity-70">{item.ratio}</span>
                </>
              }
              hint={`${item.width}×${item.height} · ${item.hint}`}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Ajuste de imagen
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {IMAGE_FITS.map((item) => (
            <ChipButton
              key={item.id}
              active={item.id === value.imageFit}
              onClick={() => onChange({ imageFit: item.id })}
              title={item.label}
              hint={item.hint}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PresetRow
          label="Padding lateral (izq. + der.)"
          value={value.imagePadX}
          presets={PAD_PRESETS}
          min={0}
          max={200}
          onChange={(imagePadX) => onChange({ imagePadX })}
        />
        <PresetRow
          label="Padding vertical (sup. + inf.)"
          value={value.imagePadY}
          presets={PAD_PRESETS}
          min={0}
          max={200}
          onChange={(imagePadY) => onChange({ imagePadY })}
        />
        <PresetRow
          label="Padding texto (horizontal)"
          value={value.textPadX}
          presets={TEXT_PAD_X_PRESETS}
          min={8}
          max={160}
          onChange={(textPadX) => onChange({ textPadX })}
        />
        <PresetRow
          label="Padding texto (vertical)"
          value={value.textPadY}
          presets={TEXT_PAD_Y_PRESETS}
          min={8}
          max={160}
          onChange={(textPadY) => onChange({ textPadY })}
        />
      </div>

      <PresetRow
        label="Border radius (card + zona imagen)"
        value={value.cardRadius}
        presets={RADIUS_PRESETS}
        min={0}
        max={200}
        onChange={(cardRadius) => onChange({ cardRadius })}
      />
    </div>
  );
}
