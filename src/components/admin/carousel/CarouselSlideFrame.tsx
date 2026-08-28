"use client";

import { createContext, useContext, useMemo } from "react";
import type {
  CarouselDisplayOptions,
  CarouselFormat,
  CarouselPalette,
  CarouselSlide,
  CarouselTemplateId,
} from "@/lib/carousel-slides";
import {
  DEFAULT_CAROUSEL_DISPLAY,
  TITLE_SCALE_MULTIPLIER,
  proxiedCarouselImage,
} from "@/lib/carousel-slides";
import { getSocialHandle } from "@/lib/site";

const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

interface CarouselSlideFrameProps {
  slide: CarouselSlide;
  templateId: CarouselTemplateId;
  palette: CarouselPalette;
  format: CarouselFormat;
  totalSlides: number;
  display?: CarouselDisplayOptions;
}

interface FrameContextValue {
  showPagination: boolean;
  scale: TypeScale;
}

const FrameContext = createContext<FrameContextValue | null>(null);

function useFrameContext(): FrameContextValue {
  const ctx = useContext(FrameContext);
  if (!ctx) {
    throw new Error("CarouselSlideFrame context missing");
  }
  return ctx;
}

function scaledTypeScale(
  base: TypeScale,
  titleScale: CarouselDisplayOptions["titleScale"],
): TypeScale {
  const multiplier = TITLE_SCALE_MULTIPLIER[titleScale];
  return {
    ...base,
    meta: Math.round(base.meta * multiplier),
    title: Math.round(base.title * multiplier),
    body: Math.round(base.body * multiplier),
    decor: Math.round(base.decor * multiplier),
  };
}

/** Escala unificada en px para canvas 1080 (solo 4 tamaños de texto). */
interface TypeScale {
  /** No., eyebrow, footer, badge, pill CTA */
  meta: number;
  /** Todos los títulos (portada, contenido, CTA, engagement) */
  title: number;
  /** Todos los párrafos y citas */
  body: number;
  /** Números decorativos y comilla grande */
  decor: number;
  pad: number;
  padLg: number;
}

function typeScale(isStory: boolean): TypeScale {
  if (isStory) {
    return {
      meta: 32,
      title: 80,
      body: 48,
      decor: 300,
      pad: 88,
      padLg: 104,
    };
  }
  return {
    meta: 26,
    title: 58,
    body: 38,
    decor: 210,
    pad: 68,
    padLg: 84,
  };
}

const metaStyle = { letterSpacing: "0.18em" as const };
const titleStyle = { lineHeight: 1.1 };
const bodyStyle = { lineHeight: 1.48 };

function PaperCanvas({
  children,
  palette,
  dark = false,
}: {
  children: React.ReactNode;
  palette: CarouselPalette;
  dark?: boolean;
}) {
  const background = dark
    ? palette.ctaBgGradient ?? palette.ctaBg
    : palette.bgGradient ?? palette.bg;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background,
        color: dark ? palette.ctaText : palette.text,
      }}
    >
      {!dark && palette.bgOverlay ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: palette.bgOverlay }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-multiply"
        style={{ backgroundImage: PAPER_NOISE, backgroundSize: "180px 180px" }}
      />
      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  );
}

function SlideFooter({
  palette,
  dark = false,
  overlay = false,
  isLast,
}: {
  palette: CarouselPalette;
  dark?: boolean;
  overlay?: boolean;
  isLast: boolean;
}) {
  const { showPagination, scale } = useFrameContext();
  if (!showPagination) return null;

  const color = overlay
    ? "rgba(255,255,255,0.9)"
    : dark
      ? `${palette.ctaText}bb`
      : palette.muted;
  return (
    <div
      className="mt-auto flex shrink-0 items-center justify-between gap-6 pt-8 font-semibold uppercase"
      style={{
        color,
        fontSize: scale.meta,
        ...metaStyle,
      }}
    >
      <span>{getSocialHandle()}</span>
      <span>{isLast ? "Enlace en bio" : "Desliza →"}</span>
    </div>
  );
}

function SlideNumber({
  n,
  palette,
  variant = "label",
  dark = false,
}: {
  n: number;
  palette: CarouselPalette;
  variant?: "label" | "circle" | "giant";
  dark?: boolean;
}) {
  const { showPagination, scale } = useFrameContext();
  if (!showPagination && variant !== "giant") return null;

  const color = dark ? palette.ctaText : palette.muted;
  if (variant === "giant") {
    return (
      <span
        className="pointer-events-none select-none font-display font-bold leading-none tracking-tight"
        style={{
          fontSize: scale.decor,
          color: `${palette.accent}70`,
        }}
        aria-hidden
      >
        {String(n).padStart(2, "0")}
      </span>
    );
  }
  if (variant === "circle") {
    return (
      <div
        className="flex items-center justify-center rounded-full border font-bold"
        style={{
          width: scale.meta * 2.4,
          height: scale.meta * 2.4,
          borderColor: palette.line,
          color: palette.text,
          fontSize: scale.meta * 0.9,
          letterSpacing: "0.12em",
        }}
      >
        {String(n).padStart(3, "0")}
      </div>
    );
  }
  return (
    <span
      className="font-semibold uppercase"
      style={{ color, fontSize: scale.meta, ...metaStyle }}
    >
      No. {n}
    </span>
  );
}

function ContentDivider({ palette }: { palette: CarouselPalette }) {
  const { scale } = useFrameContext();
  return (
    <div
      className="flex items-center gap-5"
      style={{ margin: `${scale.meta}px 0` }}
    >
      <div className="h-px flex-1" style={{ background: palette.line }} />
      <div
        className="rounded-full"
        style={{
          width: scale.meta * 0.4,
          height: scale.meta * 0.4,
          background: palette.accent,
        }}
      />
      <div className="h-px flex-1" style={{ background: palette.line }} />
    </div>
  );
}

function FramedImage({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedCarouselImage(src)}
      alt=""
      crossOrigin="anonymous"
      className={`object-cover ${className}`}
    />
  );
}

function ContentTextBlock({
  slide,
  palette,
  showGiantStep = true,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  showGiantStep?: boolean;
}) {
  const { scale } = useFrameContext();
  return (
    <div className="relative flex flex-1 flex-col justify-center py-6">
      {showGiantStep && slide.kind === "content" ? (
        <div className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2">
          <SlideNumber
            n={slide.slideNumber}
            palette={palette}
            variant="giant"
          />
        </div>
      ) : null}
      <div className="relative z-10 max-w-[92%]">
        <SlideNumber n={slide.slideNumber} palette={palette} />
        {slide.title ? (
          <h3
            className="font-display mt-6 font-medium tracking-tight"
            style={{ fontSize: scale.title, ...titleStyle }}
          >
            {slide.title}
          </h3>
        ) : null}
        <ContentDivider palette={palette} />
        <p
          className="font-medium"
          style={{
            color: palette.muted,
            fontSize: scale.body,
            ...bodyStyle,
          }}
        >
          {slide.body}
        </p>
      </div>
    </div>
  );
}

function FrostedCard({
  children,
  className = "",
  position = "top",
}: {
  children: React.ReactNode;
  className?: string;
  position?: "top" | "center";
}) {
  const { scale } = useFrameContext();
  return (
    <div
      className={`mx-auto w-[92%] max-w-[960px] rounded-sm border border-white/40 bg-white/85 shadow-[0_24px_64px_rgba(0,0,0,0.22)] backdrop-blur-md ${
        position === "center" ? "my-auto" : ""
      } ${className}`}
      style={{ padding: scale.pad * 0.75 }}
    >
      {children}
    </div>
  );
}

function EngagementSlide({
  slide,
  palette,
  isStory,
  isLast,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  isStory: boolean;
  isLast: boolean;
}) {
  const { scale } = useFrameContext();
  return (
    <PaperCanvas palette={palette}>
      <div
        className="flex flex-1 flex-col"
        style={{ padding: scale.pad }}
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <SlideNumber n={slide.slideNumber} palette={palette} />
          <div
            className="my-8 h-px w-24"
            style={{ background: palette.accent }}
          />
          <h2
            className="font-display max-w-[88%] font-medium tracking-tight"
            style={{ fontSize: scale.title, ...titleStyle }}
          >
            {slide.title}
          </h2>
          <p
            className="mt-8 max-w-[86%] font-medium"
            style={{ color: palette.muted, fontSize: scale.body, ...bodyStyle }}
          >
            {slide.body}
          </p>
          <div
            className="mt-12 flex gap-12 font-light"
            style={{ color: palette.muted, fontSize: scale.body }}
          >
            <span aria-hidden>♡</span>
            <span aria-hidden>◇</span>
            <span aria-hidden>↗</span>
          </div>
        </div>
        <SlideFooter palette={palette} isLast={isLast} />
      </div>
    </PaperCanvas>
  );
}

function CtaSlide({
  slide,
  palette,
  isStory,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  isStory: boolean;
}) {
  const { scale } = useFrameContext();
  const handle = getSocialHandle();
  return (
    <PaperCanvas palette={palette} dark>
      <div
        className="flex flex-1 flex-col"
        style={{ padding: scale.padLg }}
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <SlideNumber n={slide.slideNumber} palette={palette} dark />
          <div
            className="my-10 h-px w-20"
            style={{ background: `${palette.ctaText}66` }}
          />
          <h2
            className="font-display max-w-[90%] font-medium tracking-tight"
            style={{ fontSize: scale.title, ...titleStyle }}
          >
            {slide.title}
          </h2>
          <p
            className="mt-8 max-w-[88%] font-medium"
            style={{
              color: `${palette.ctaText}dd`,
              fontSize: scale.body,
              ...bodyStyle,
            }}
          >
            {slide.body}
          </p>
          <div
            className="mt-12 rounded-full border-2 px-10 py-4 font-bold uppercase"
            style={{
              borderColor: `${palette.ctaText}55`,
              color: palette.ctaText,
              fontSize: scale.meta,
              ...metaStyle,
            }}
          >
            {handle} · enlace en bio
          </div>
        </div>
      </div>
    </PaperCanvas>
  );
}

function QuoteSlide({
  slide,
  palette,
  isStory,
  isLast,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  isStory: boolean;
  isLast: boolean;
}) {
  const { scale } = useFrameContext();
  return (
    <PaperCanvas palette={palette}>
      <div
        className="flex flex-1 flex-col"
        style={{ padding: scale.padLg }}
      >
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <SlideNumber n={slide.slideNumber} palette={palette} />
          <p
            className="font-display mt-6 leading-none"
            style={{ color: palette.accent, fontSize: scale.decor }}
          >
            “
          </p>
          <div
            className="my-8 h-px w-24"
            style={{ background: palette.accent }}
          />
          <p
            className="font-display max-w-[90%] font-medium tracking-tight"
            style={{ fontSize: scale.body, ...bodyStyle }}
          >
            {slide.body}
          </p>
          <div
            className="mt-12 rounded-full px-6 py-2 font-bold uppercase"
            style={{
              background: palette.badge,
              color: palette.muted,
              fontSize: scale.meta,
              ...metaStyle,
            }}
          >
            Vivencia · detalle
          </div>
        </div>
        <SlideFooter palette={palette} isLast={isLast} />
      </div>
    </PaperCanvas>
  );
}

function FullImageSlide({
  slide,
  palette,
  isStory,
  isLast,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  isStory: boolean;
  isLast: boolean;
}) {
  const { scale } = useFrameContext();
  const imageSrc = slide.imageUrl;

  if (!imageSrc) {
    return (
      <EditorialSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  }

  const cardPosition = slide.kind === "cover" ? "top" : "center";

  return (
    <div className="relative h-full w-full overflow-hidden text-[#1f1c19]">
      <FramedImage src={imageSrc} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

      <div
        className="relative flex h-full flex-col"
        style={{ padding: scale.pad }}
      >
        <FrostedCard position={cardPosition}>
          {slide.kind === "cover" ? (
            <>
              <SlideNumber n={slide.slideNumber} palette={palette} />
              <p
                className="mt-5 font-semibold uppercase"
                style={{
                  color: palette.muted,
                  fontSize: scale.meta,
                  ...metaStyle,
                  lineHeight: 1.35,
                }}
              >
                {slide.eyebrow}
              </p>
              <h2
                className="font-display mt-6 font-medium tracking-tight"
                style={{ fontSize: scale.title, ...titleStyle }}
              >
                {slide.title}
              </h2>
            </>
          ) : (
            <>
              <SlideNumber n={slide.slideNumber} palette={palette} />
              {slide.title ? (
                <h3
                  className="font-display mt-6 font-medium tracking-tight"
                  style={{ fontSize: scale.title, ...titleStyle }}
                >
                  {slide.title}
                </h3>
              ) : null}
              {slide.body ? (
                <>
                  <ContentDivider palette={palette} />
                  <p
                    className="font-medium"
                    style={{
                      color: palette.muted,
                      fontSize: scale.body,
                      ...bodyStyle,
                    }}
                  >
                    {slide.body}
                  </p>
                </>
              ) : null}
            </>
          )}
        </FrostedCard>

        <SlideFooter palette={palette} overlay isLast={isLast} />
      </div>
    </div>
  );
}

function EditorialSlide({
  slide,
  palette,
  isStory,
  isLast,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  isStory: boolean;
  isLast: boolean;
}) {
  const { scale } = useFrameContext();

  if (slide.kind === "cover") {
    return (
      <PaperCanvas palette={palette}>
        <div className="flex flex-1 flex-col" style={{ padding: scale.pad }}>
          <SlideNumber n={slide.slideNumber} palette={palette} />
          <p
            className="mt-6 font-semibold uppercase"
            style={{
              color: palette.muted,
              fontSize: scale.meta,
              ...metaStyle,
              lineHeight: 1.35,
            }}
          >
            {slide.eyebrow}
          </p>
          <h2
            className="font-display mt-6 font-medium tracking-tight"
            style={{ fontSize: scale.title, ...titleStyle }}
          >
            {slide.title}
          </h2>
          {slide.imageUrl ? (
            <div
              className="mt-8 min-h-[240px] flex-1 overflow-hidden border p-1.5"
              style={{ borderColor: palette.line }}
            >
              <FramedImage src={slide.imageUrl} className="h-full w-full" />
            </div>
          ) : (
            <div
              className="mt-8 flex flex-1 items-center justify-center border border-dashed"
              style={{
                borderColor: palette.line,
                color: palette.muted,
                fontSize: scale.body,
              }}
            >
              Sin imagen destacada
            </div>
          )}
          <SlideFooter palette={palette} isLast={isLast} />
        </div>
      </PaperCanvas>
    );
  }

  if (slide.kind === "content" && slide.imageUrl) {
    return (
      <PaperCanvas palette={palette}>
        <div className="relative flex-1">
          <FramedImage src={slide.imageUrl} className="absolute inset-0 h-full w-full" />
          <div
            className="absolute inset-x-6 bottom-6 rounded-sm border backdrop-blur-md"
            style={{
              borderColor: `${palette.line}cc`,
              background: `${palette.bg}e6`,
              padding: scale.pad * 0.65,
            }}
          >
            <SlideNumber n={slide.slideNumber} palette={palette} />
            {slide.title ? (
              <h3
                className="font-display mt-5 font-medium tracking-tight"
                style={{ fontSize: scale.title, ...titleStyle }}
              >
                {slide.title}
              </h3>
            ) : null}
            <ContentDivider palette={palette} />
            <p
              className="font-medium"
              style={{
                color: palette.muted,
                fontSize: scale.body,
                ...bodyStyle,
              }}
            >
              {slide.body}
            </p>
          </div>
        </div>
        <div style={{ padding: `0 ${scale.pad}px ${scale.pad * 0.75}px` }}>
          <SlideFooter palette={palette} isLast={isLast} />
        </div>
      </PaperCanvas>
    );
  }

  return (
    <PaperCanvas palette={palette}>
      <div className="flex flex-1 flex-col" style={{ padding: scale.padLg }}>
        <ContentTextBlock slide={slide} palette={palette} />
        <SlideFooter palette={palette} isLast={isLast} />
      </div>
    </PaperCanvas>
  );
}

function SplitSlide({
  slide,
  palette,
  isStory,
  isLast,
}: {
  slide: CarouselSlide;
  palette: CarouselPalette;
  isStory: boolean;
  isLast: boolean;
}) {
  const { scale } = useFrameContext();
  const textPad = isStory
    ? `${scale.padLg}px ${scale.pad}px ${scale.padLg}px ${scale.padLg + 16}px`
    : `${scale.pad}px ${scale.pad * 0.85}px ${scale.pad}px ${scale.pad + 12}px`;

  if (slide.kind === "cover") {
    return (
      <PaperCanvas palette={palette}>
        <div className="grid h-full flex-1 grid-cols-2">
          <div
            className="relative flex flex-col justify-between"
            style={{ padding: textPad }}
          >
            <p
              className="absolute left-5 top-1/2 -translate-y-1/2 font-semibold uppercase [writing-mode:vertical-rl]"
              style={{
                color: palette.muted,
                fontSize: scale.meta,
                letterSpacing: "0.35em",
              }}
            >
              Lectura editorial
            </p>
            <div>
              <SlideNumber
                n={slide.slideNumber}
                palette={palette}
                variant="circle"
              />
              <p
                className="mt-7 font-semibold uppercase"
                style={{
                  color: palette.muted,
                  fontSize: scale.meta,
                  ...metaStyle,
                  lineHeight: 1.35,
                }}
              >
                {slide.eyebrow}
              </p>
              <h2
                className="font-display mt-6 font-medium tracking-tight"
                style={{ fontSize: scale.title, ...titleStyle }}
              >
                {slide.title}
              </h2>
            </div>
            <SlideFooter palette={palette} isLast={isLast} />
          </div>
          <div className="relative border-l" style={{ borderColor: palette.line }}>
            {slide.imageUrl ? (
              <FramedImage src={slide.imageUrl} className="h-full w-full" />
            ) : (
              <div
                className="flex h-full items-center justify-center"
                style={{ color: palette.muted, fontSize: scale.body }}
              >
                —
              </div>
            )}
          </div>
        </div>
      </PaperCanvas>
    );
  }

  if (slide.kind === "cta") {
    return <CtaSlide slide={slide} palette={palette} isStory={isStory} />;
  }

  if (slide.kind === "engagement") {
    return (
      <EngagementSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  }

  return (
    <PaperCanvas palette={palette}>
      <div
        className="grid h-full flex-1"
        style={{ gridTemplateColumns: "1.05fr 0.95fr" }}
      >
        <div
          className="flex flex-col justify-center"
          style={{ padding: textPad }}
        >
          <SlideNumber
            n={slide.slideNumber}
            palette={palette}
            variant="circle"
          />
          {slide.title ? (
            <h3
              className="font-display mt-8 font-medium tracking-tight"
              style={{ fontSize: scale.title, ...titleStyle }}
            >
              {slide.title}
            </h3>
          ) : null}
          <ContentDivider palette={palette} />
          <p
            className="font-medium"
            style={{
              color: palette.muted,
              fontSize: scale.body,
              ...bodyStyle,
            }}
          >
            {slide.body}
          </p>
        </div>
        <div
          className="relative flex flex-col gap-3 border-l p-5"
          style={{ borderColor: palette.line }}
        >
          {slide.imageUrl ? (
            <div
              className="flex-1 overflow-hidden border"
              style={{ borderColor: palette.line }}
            >
              <FramedImage src={slide.imageUrl} className="h-full w-full" />
            </div>
          ) : null}
          {slide.secondaryImageUrl ? (
            <div
              className="h-[32%] overflow-hidden border opacity-90"
              style={{ borderColor: palette.line }}
            >
              <FramedImage
                src={slide.secondaryImageUrl}
                className="h-full w-full"
              />
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ padding: `0 ${scale.pad}px ${scale.pad * 0.75}px` }}>
        <SlideFooter palette={palette} isLast={isLast} />
      </div>
    </PaperCanvas>
  );
}

export function CarouselSlideFrame({
  slide,
  templateId,
  palette,
  format,
  totalSlides,
  display = DEFAULT_CAROUSEL_DISPLAY,
}: CarouselSlideFrameProps) {
  const isStory = format.id === "story";
  const isLast = slide.slideNumber >= totalSlides;

  const frameValue = useMemo(
    () => ({
      showPagination: display.showPagination,
      scale: scaledTypeScale(typeScale(isStory), display.titleScale),
    }),
    [display.showPagination, display.titleScale, isStory],
  );

  let content: React.ReactNode;

  if (slide.kind === "cta") {
    content = <CtaSlide slide={slide} palette={palette} isStory={isStory} />;
  } else if (slide.kind === "engagement") {
    content = (
      <EngagementSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  } else if (slide.kind === "quote") {
    content = (
      <QuoteSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  } else if (templateId === "fullimage") {
    content = (
      <FullImageSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  } else if (templateId === "split") {
    content = (
      <SplitSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  } else {
    content = (
      <EditorialSlide
        slide={slide}
        palette={palette}
        isStory={isStory}
        isLast={isLast}
      />
    );
  }

  return (
    <FrameContext.Provider value={frameValue}>{content}</FrameContext.Provider>
  );
}
