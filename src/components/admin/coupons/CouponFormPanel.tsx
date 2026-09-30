"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Loader2, Plus } from "lucide-react";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import type { FormState } from "@/components/admin/coupons/couponsAdmin";

/** Panel lateral de alta/edición de un cupón. */
export function CouponFormPanel({
  open,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <AdminSidePanel
      open={open}
      onClose={onClose}
      eyebrow={form.id ? "Editar" : "Alta"}
      title={form.id ? "Editar cupón" : "Nuevo cupón"}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="admin-btn admin-btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            form="admin-coupon-form"
            disabled={saving}
            className="admin-btn admin-btn-primary"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {form.id ? "Guardar cambios" : "Crear cupón"}
          </button>
        </>
      }
    >
      <form id="admin-coupon-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">

          <label className="admin-field-label block text-sm">
            <span>Tienda (slug)</span>
            <input
              required
              value={form.retailer}
              onChange={(e) => setForm((f) => ({ ...f, retailer: e.target.value }))}
              className="admin-input"
              placeholder="amazon"
            />
          </label>
          <label className="admin-field-label block text-sm">
            <span>Código</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="admin-input font-mono"
              placeholder="MODA15"
            />
          </label>
          <label className="admin-field-label block text-sm md:col-span-2">
            <span>Título</span>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="admin-input"
            />
          </label>
          <label className="admin-field-label block text-sm md:col-span-2">
            <span>Descripción</span>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="admin-input"
            />
          </label>
          <label className="admin-field-label block text-sm md:col-span-2">
            <span>Condiciones</span>
            <textarea
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              className="admin-input"
            />
          </label>
          <label className="admin-field-label block text-sm md:col-span-2">
            <span>URL</span>
            <input
              required
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="admin-input"
            />
          </label>
          <label className="admin-field-label block text-sm">
            <span>Inicio</span>
            <input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              className="admin-input"
            />
          </label>
          <label className="admin-field-label block text-sm">
            <span>Caduca</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, expiresAt: e.target.value }))
              }
              className="admin-input"
            />
          </label>
        
        </div>

        <div className="flex flex-wrap gap-4 text-sm">

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.highlight}
              onChange={(e) =>
                setForm((f) => ({ ...f, highlight: e.target.checked }))
              }
            />
            Destacado
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            Activo
          </label>
        
        </div>
      </form>
    </AdminSidePanel>
  );
}
