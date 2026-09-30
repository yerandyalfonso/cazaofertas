/**
 * Datos del titular y del autor que muestran «Aviso legal», «Privacidad» y
 * «Sobre el blog». Mientras un campo esté vacío, la página lo omite o usa un
 * texto genérico (ver TAREAS.md: la LSSI, art. 10, exige nombre, NIF,
 * domicilio y un email de contacto).
 */
export const LEGAL_OWNER = {
  /** Nombre y apellidos (o razón social) del titular. */
  name: "",
  /** NIF / NIE. */
  taxId: "",
  /** Domicilio completo. */
  address: "",
  /** Email de contacto para dudas y derechos de privacidad. */
  email: "",
} as const;

/** Quién escribe el blog (firma con seudónimo). */
export const BLOG_AUTHOR = {
  /** Seudónimo con el que firma. */
  pseudonym: "",
  /** Unas líneas sobre quién es, en primera persona. */
  bio: [] as string[],
} as const;

/** Fecha de la última revisión de los textos legales (AAAA-MM-DD). */
export const LEGAL_UPDATED_AT = "2026-09-30";

export function formatLegalDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
