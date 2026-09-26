import { NextResponse } from "next/server";

// No hace nada, pero debe existir: sin él, Next resuelve el src/proxy.ts de
// la raíz del monorepo (el del admin de CazaOfertas) y el build falla.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
