/**
 * Sincroniza los proyectos de diseño (tarjetas, carruseles, vídeos) con la
 * tabla design_projects. localStorage sigue siendo la caché local para que
 * las lecturas del editor sean síncronas; cada escritura se encola y se
 * envía al servidor. La cola sobrevive a recargas: si falla la red, se
 * reintenta en la siguiente sincronización.
 *
 * Primera sincronización en un navegador: todo lo que haya en localStorage
 * se sube (migración desde la versión solo-local).
 */

export type DesignProjectKind = "card" | "carousel" | "video";

interface StoredProject {
  id: string;
  name: string;
  updatedAt: string;
}

/** id → updatedAt pendiente de subir; deletes: ids pendientes de borrar. */
interface PendingQueue {
  upserts: Record<string, string>;
  deletes: string[];
}

const API = "/api/admin/design-projects";

function pendingKey(kind: DesignProjectKind) {
  return `cazaofertas.design-projects.pending.${kind}`;
}

function migratedKey(kind: DesignProjectKind) {
  return `cazaofertas.design-projects.migrated.${kind}`;
}

function readLocal(storageKey: string): StoredProject[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.id && item?.name)
      : [];
  } catch {
    return [];
  }
}

function readPending(kind: DesignProjectKind): PendingQueue {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(pendingKey(kind)) ?? "null",
    );
    if (parsed && typeof parsed === "object") {
      return {
        upserts: parsed.upserts ?? {},
        deletes: Array.isArray(parsed.deletes) ? parsed.deletes : [],
      };
    }
  } catch {
    // cola corrupta: se descarta
  }
  return { upserts: {}, deletes: [] };
}

function writePending(kind: DesignProjectKind, queue: PendingQueue) {
  window.localStorage.setItem(pendingKey(kind), JSON.stringify(queue));
}

function hasPending(queue: PendingQueue) {
  return Object.keys(queue.upserts).length > 0 || queue.deletes.length > 0;
}

const storageKeys: Partial<Record<DesignProjectKind, string>> = {};
const flushing: Partial<Record<DesignProjectKind, Promise<boolean>>> = {};

/** Envía la cola al servidor. Devuelve true si queda vacía. */
function flush(kind: DesignProjectKind): Promise<boolean> {
  const previous = flushing[kind] ?? Promise.resolve(true);
  const next = previous.then(() => flushOnce(kind));
  flushing[kind] = next;
  return next;
}

async function flushOnce(kind: DesignProjectKind): Promise<boolean> {
  const storageKey = storageKeys[kind];
  if (!storageKey) return false;
  const queue = readPending(kind);
  if (!hasPending(queue)) return true;

  try {
    const sent = { ...queue.upserts };
    const ids = new Set(Object.keys(sent));
    const projects = readLocal(storageKey).filter((item) => ids.has(item.id));
    if (projects.length > 0) {
      const response = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, projects }),
      });
      if (!response.ok) throw new Error(`PUT ${response.status}`);
    }

    const deleted: string[] = [];
    for (const id of queue.deletes) {
      const params = new URLSearchParams({ kind, id });
      const response = await fetch(`${API}?${params}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`DELETE ${response.status}`);
      deleted.push(id);
    }

    // Solo se quita lo enviado; si se editó durante el envío, sigue en cola.
    const current = readPending(kind);
    for (const [id, updatedAt] of Object.entries(sent)) {
      if (current.upserts[id] === updatedAt) delete current.upserts[id];
    }
    current.deletes = current.deletes.filter((id) => !deleted.includes(id));
    writePending(kind, current);
    return !hasPending(current);
  } catch (error) {
    console.warn(`[design-projects] no se pudo sincronizar ${kind}`, error);
    return false;
  }
}

/** Encola la subida de un proyecto ya guardado en localStorage. */
export function queueDesignProjectUpsert(
  kind: DesignProjectKind,
  storageKey: string,
  project: StoredProject,
): void {
  if (typeof window === "undefined") return;
  storageKeys[kind] = storageKey;
  const queue = readPending(kind);
  queue.upserts[project.id] = project.updatedAt;
  queue.deletes = queue.deletes.filter((id) => id !== project.id);
  writePending(kind, queue);
  void flush(kind);
}

/** Encola el borrado de un proyecto ya quitado de localStorage. */
export function queueDesignProjectDelete(
  kind: DesignProjectKind,
  storageKey: string,
  id: string,
): void {
  if (typeof window === "undefined") return;
  storageKeys[kind] = storageKey;
  const queue = readPending(kind);
  delete queue.upserts[id];
  if (!queue.deletes.includes(id)) queue.deletes.push(id);
  writePending(kind, queue);
  void flush(kind);
}

/**
 * Trae los proyectos del servidor a localStorage. Llamar antes de leer
 * (al montar listas y editores). Si hay cambios locales sin subir o el
 * servidor no responde, se conserva lo local.
 */
export async function pullDesignProjects(
  kind: DesignProjectKind,
  storageKey: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  storageKeys[kind] = storageKey;

  if (!window.localStorage.getItem(migratedKey(kind))) {
    const queue = readPending(kind);
    for (const project of readLocal(storageKey)) {
      queue.upserts[project.id] = project.updatedAt;
    }
    writePending(kind, queue);
  }

  const flushed = await flush(kind);
  if (!flushed) return;
  window.localStorage.setItem(migratedKey(kind), new Date().toISOString());

  try {
    const response = await fetch(`${API}?kind=${kind}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`GET ${response.status}`);
    const payload = (await response.json()) as { projects?: unknown[] };
    // Si mientras tanto se editó algo, no se pisa.
    if (hasPending(readPending(kind))) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(payload.projects ?? []),
    );
  } catch (error) {
    console.warn(`[design-projects] no se pudo cargar ${kind}`, error);
  }
}
