import { AdminShell } from "@/components/admin/AdminShell";

/** Acceso libre: sin middleware ni contraseña. */
export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
