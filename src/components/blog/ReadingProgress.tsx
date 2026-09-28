"use client";

import { useEffect, useRef } from "react";

/** Barra fina de progreso de lectura; mide el <article> que la contiene. */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const track = bar?.parentElement;
    const article = bar?.closest("article");
    if (!bar || !track || !article) return;
    // La barra va pegada al borde inferior de la cabecera fija, esté donde esté
    // (con la franja superior visible la cabecera empieza más abajo).
    const header = document.querySelector<HTMLElement>("body header");

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      bar.style.transform = `scaleX(${progress})`;
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      track.style.transform = `translateY(${Math.max(0, headerBottom)}px)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] bg-stone-200/60"
    >
      <div
        ref={barRef}
        style={{ transform: "scaleX(0)" }}
        className="h-full origin-left bg-teal-700"
      />
    </div>
  );
}
