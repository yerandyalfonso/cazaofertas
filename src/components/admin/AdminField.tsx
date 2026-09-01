import type { ReactNode } from "react";

type AdminFieldProps = {
  label: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
};

/** Etiqueta + control con espaciado compacto y consistente. */
export function AdminField({
  label,
  hint,
  children,
  className = "",
}: AdminFieldProps) {
  return (
    <div className={`admin-field ${className}`.trim()}>
      <div className="admin-field-label">
        <span className="admin-field-label__text">{label}</span>
        {hint ? (
          <span className="admin-field-label__hint">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
