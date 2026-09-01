"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, MoreVertical } from "lucide-react";

export interface AdminRowMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "default" | "danger";
  hidden?: boolean;
}

const PANEL_MIN_WIDTH = 184;

export function AdminRowMenu({
  items,
  align = "end",
  label = "Más acciones",
}: {
  items: AdminRowMenuItem[];
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const visibleItems = items.filter((item) => !item.hidden);

  function updatePanelPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const left =
      align === "end"
        ? Math.max(8, rect.right - PANEL_MIN_WIDTH)
        : Math.min(rect.left, window.innerWidth - PANEL_MIN_WIDTH - 8);
    setPanelStyle({
      top: rect.bottom + 6,
      left,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !(target instanceof Element && target.closest(".admin-row-menu__panel"))
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      updatePanelPosition();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, align]);

  if (visibleItems.length === 0) return null;

  const panel =
    open && panelStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            role="menu"
            style={{
              position: "fixed",
              top: panelStyle.top,
              left: panelStyle.left,
              minWidth: PANEL_MIN_WIDTH,
            }}
            className="admin-row-menu__panel"
          >
            {visibleItems.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled || item.loading}
                onClick={() => {
                  if (item.disabled || item.loading) return;
                  setOpen(false);
                  item.onSelect();
                }}
                className={`admin-row-menu__item${
                  item.tone === "danger" ? " admin-row-menu__item--danger" : ""
                }`}
              >
                <span className="admin-row-menu__icon" aria-hidden>
                  {item.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    item.icon
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="admin-row-menu">
      <button
        ref={triggerRef}
        type="button"
        className="admin-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {panel}
    </div>
  );
}
