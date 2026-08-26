import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Política de privacidad",
  description:
    "Cómo trata CazaOferta los datos personales y el uso del bot de Telegram.",
  path: "/privacidad",
});

export default function PrivacidadPage() {
  return (
    <LegalPage eyebrow="Legal" title="Política de privacidad">
      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Responsable
        </h2>
        <p>
          El responsable del tratamiento de los datos asociados al Sitio y al
          bot de Telegram de CazaOferta es el titular del proyecto CazaOferta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Datos que tratamos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Telegram:</strong> identificador de usuario, nombre de
            usuario (si existe) y preferencias de alertas que configures al
            interactuar con el bot.
          </li>
          <li>
            <strong>Administración:</strong> sesión técnica mediante cookie
            cuando accedes al panel `/admin` (no es un área pública).
          </li>
          <li>
            <strong>Técnicos:</strong> logs de servidor y métricas necesarias
            para el funcionamiento del Sitio y de los cron jobs.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Finalidad y base jurídica
        </h2>
        <p>
          Tratamos estos datos para prestar el servicio de alertas, mejorar el
          Sitio y garantizar la seguridad. La base es la ejecución del servicio
          solicitado (p. ej. crear una alerta) y el interés legítimo en
          mantener el servicio operativo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Conservación y cesiones
        </h2>
        <p>
          Conservamos los datos mientras la alerta o la cuenta asociada estén
          activas y el tiempo necesario para obligaciones legales. Usamos
          proveedores de infraestructura (hosting, base de datos) bajo
          contrato; no vendemos datos personales a terceros con fines de
          marketing.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Cookies
        </h2>
        <p>
          El Sitio público no depende de cookies de publicidad. El panel de
          administración usa una cookie de sesión para autenticar al editor.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Derechos
        </h2>
        <p>
          Puedes solicitar acceso, rectificación o eliminación de tus datos
          asociados a Telegram dejando de usar el bot y solicitando el borrado
          de alertas, o contactando al titular del Sitio. También puedes
          presentar una reclamación ante la autoridad de control competente.
        </p>
      </section>
    </LegalPage>
  );
}
