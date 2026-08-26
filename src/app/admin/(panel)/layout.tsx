import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminAuthenticated } from "@/lib/admin-auth";

/** Panel protegido: cookie de sesión o redirección a login. */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
