import { Suspense } from "react";
import { OperationsAdminClient } from "@/components/admin/OperationsAdminClient";

export default function AdminCronPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-card p-8 text-sm text-stone-500">
          Cargando operaciones…
        </div>
      }
    >
      <OperationsAdminClient />
    </Suspense>
  );
}
