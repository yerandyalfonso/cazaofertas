import Link from "next/link";

type AdminEmptyStateProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
};

export function AdminEmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}: AdminEmptyStateProps) {
  const action =
    actionLabel && actionHref ? (
      <Link href={actionHref} className="admin-btn admin-btn-primary mt-5">
        {actionLabel}
      </Link>
    ) : actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="admin-btn admin-btn-primary mt-5"
      >
        {actionLabel}
      </button>
    ) : null;

  return (
    <div
      className={`admin-empty-state border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center ${className}`}
    >
      <p className="text-base font-semibold text-[var(--text)]">{title}</p>
      {subtitle ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
          {subtitle}
        </p>
      ) : null}
      {action}
    </div>
  );
}
