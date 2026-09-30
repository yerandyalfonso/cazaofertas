"use client";

import { AdminRetailerBadge } from "@/components/admin/AdminListChrome";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import {
  productStatusBadges,
  type AdminProduct,
} from "@/components/admin/products/productsAdmin";
import { availabilityLabel } from "@/lib/out-of-stock-policy";
import { splitProductDescription } from "@/lib/product-description";
import { retailerBuyCtaLabel, retailerLabel } from "@/lib/retailers";

/** Panel lateral «Consulta BD» con todos los datos guardados de un producto. */
export function ProductDetailPanel({
  product,
  onClose,
  onEdit,
}: {
  product: AdminProduct | null;
  onClose: () => void;
  onEdit: (product: AdminProduct) => void;
}) {
  return (
    <AdminSidePanel
      open={Boolean(product)}
      onClose={() => onClose()}
      eyebrow="Consulta BD"
      title={product?.title ?? ""}
      size="xl"
      headerActions={
        product ? (
          <>
            <a
              href={`/producto/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn admin-btn-ghost h-9 px-3 text-xs"
            >
              Ver en web
            </a>
            <a
              href={
                product.productUrl ||
                product.amazonUrl ||
                (product.retailer === "amazon"
                  ? `https://www.amazon.es/dp/${product.asin}`
                  : "#")
              }
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn admin-btn-primary h-9 px-3 text-xs"
            >
              {retailerBuyCtaLabel(product.retailer)}
            </a>
            <button
              type="button"
              onClick={() => {
                onEdit(product);
              }}
              className="admin-btn admin-btn-ghost h-9 px-3 text-xs"
            >
              Editar
            </button>
          </>
        ) : null
      }
    >
      {product ? (
        <>
          <div className="admin-detail-hero">
            <div className="admin-detail-hero__image">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-muted)]">
                  Sin imagen
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                <AdminRetailerBadge retailer={product.retailer} />
                {product.discountPercentage > 0 ? (
                  <span className="admin-badge">
                    −{Math.round(product.discountPercentage)}%
                  </span>
                ) : null}
                <span className="admin-badge admin-badge--muted">
                  {Math.round(product.dealScore)} · {product.dealLabel}
                </span>
                {productStatusBadges(product).map((badge) => (
                  <span
                    key={badge.key}
                    className={`inline-flex rounded-sm border px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">
                {product.currentPrice.toFixed(2)} €
                {product.previousPrice != null ? (
                  <span className="ml-2 text-base font-medium text-[var(--text-muted)] line-through">
                    {product.previousPrice.toFixed(2)} €
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {product.brand ?? "Sin marca"}
                {product.category?.name
                  ? ` · ${product.category.name}`
                  : ""}
              </p>
              <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">
                {product.externalId ?? product.asin}
              </p>
            </div>
          </div>

          <section className="admin-detail-section">
            <h3>Identificación</h3>
            <dl className="admin-detail-grid">
              {(
                [
                  ["Tienda", retailerLabel(product.retailer)],
                  ["ASIN / ID", product.asin],
                  ["Externo", product.externalId ?? "—"],
                  ["Slug", product.slug],
                  ["Marca", product.brand ?? "—"],
                  ["Categoría", product.category?.name ?? "—"],
                  ["UUID", product.id],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className={label === "UUID" || label === "Slug" ? "admin-detail-muted" : undefined}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="admin-detail-section">
            <h3>Precios</h3>
            <dl className="admin-detail-grid">
              {(
                [
                  ["Actual", `${product.currentPrice.toFixed(2)} €`],
                  [
                    "Anterior",
                    product.previousPrice != null
                      ? `${product.previousPrice.toFixed(2)} €`
                      : "—",
                  ],
                  [
                    "Mínimo",
                    product.lowestPrice != null
                      ? `${product.lowestPrice.toFixed(2)} €`
                      : "—",
                  ],
                  [
                    "Máximo",
                    product.highestPrice != null
                      ? `${product.highestPrice.toFixed(2)} €`
                      : "—",
                  ],
                  [
                    "Media 30d",
                    product.averagePrice30d != null
                      ? `${product.averagePrice30d.toFixed(2)} €`
                      : "—",
                  ],
                  [
                    "Media 90d",
                    product.averagePrice90d != null
                      ? `${product.averagePrice90d.toFixed(2)} €`
                      : "—",
                  ],
                  [
                    "Descuento",
                    product.discountPercentage > 0
                      ? `−${Math.round(product.discountPercentage)}%`
                      : "—",
                  ],
                  [
                    "Score",
                    `${Math.round(product.dealScore)} · ${product.dealLabel}`,
                  ],
                  ["Nivel", product.dealLevel ?? "—"],
                  ["Moneda", product.currency ?? "EUR"],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="admin-detail-section">
            <h3>Estado</h3>
            <dl className="admin-detail-grid">
              {(
                [
                  [
                    "Disponibilidad",
                    product.availabilityLabel ??
                      availabilityLabel(product.availability),
                  ],
                  [
                    "Agotado desde",
                    product.outOfStockAt
                      ? new Date(product.outOfStockAt).toLocaleString("es-ES")
                      : "—",
                  ],
                  ["Activo", product.isActive ? "Sí" : "No"],
                  ["Destacado", product.isFeatured ? "Sí" : "No"],
                  [
                    "Última revisión",
                    product.lastCheckedAt
                      ? new Date(product.lastCheckedAt).toLocaleString("es-ES")
                      : "—",
                  ],
                  [
                    "Último Telegram",
                    product.lastTelegramNotifiedAt
                      ? new Date(product.lastTelegramNotifiedAt).toLocaleString("es-ES")
                      : "—",
                  ],
                  [
                    "Precio notificado",
                    product.lastTelegramNotifiedPrice != null
                      ? `${product.lastTelegramNotifiedPrice.toFixed(2)} €`
                      : "—",
                  ],
                  [
                    "Score notificado",
                    product.lastTelegramNotifiedScore != null
                      ? String(Math.round(product.lastTelegramNotifiedScore))
                      : "—",
                  ],
                  [
                    "Creado",
                    product.createdAt
                      ? new Date(product.createdAt).toLocaleString("es-ES")
                      : "—",
                  ],
                  [
                    "Actualizado",
                    product.updatedAt
                      ? new Date(product.updatedAt).toLocaleString("es-ES")
                      : "—",
                  ],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="admin-detail-section">
            <h3>Enlaces</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  URL producto
                </p>
                <p className="admin-detail-muted mt-1">
                  {product.productUrl || product.amazonUrl || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  Affiliate
                </p>
                <p className="admin-detail-muted mt-1">
                  {product.affiliateUrl || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  Imagen
                </p>
                <p className="admin-detail-muted mt-1">
                  {product.imageUrl || "—"}
                </p>
              </div>
            </div>
          </section>

          <section className="admin-detail-section">
            <h3>Descripción</h3>
            {(() => {
              const parts = splitProductDescription(product.description);
              if (parts.length === 0) {
                return (
                  <p className="text-sm text-[var(--text-muted)]">Sin descripción</p>
                );
              }
              return (
                <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {parts.map((part, index) => (
                    <li key={`${index}-${part.slice(0, 24)}`}>• {part}</li>
                  ))}
                </ul>
              );
            })()}
          </section>
        </>
      ) : null}
    </AdminSidePanel>
  );
}
