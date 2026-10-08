# Perfil de Facebook e Instagram (Chollos de Hoy)

Revisión del 08-10-2026. La API de Meta no permite cambiar la bio de Instagram,
las fotos de perfil ni (con los permisos del token actual) los datos de la
página de Facebook: estos cambios se hacen a mano desde las apps.

## Qué estaba mal

- **Sin foto de perfil** en Facebook ni en Instagram (silueta gris por defecto).
- **Nombre distinto**: la página y la portada dicen «Chollos d' Hoy»; la web, «Chollos de Hoy».
- **Enlaces al bot antiguo** `@cazandor_de_ofertas_bot` (sustituido el 01-10 por `@cazando_ofertas_bot`) en la bio y la web de Instagram y en la descripción de Facebook.
- Facebook **sin web**, **sin nombre de usuario** (la URL es un número) y con la categoría genérica «Producto/servicio».

## Imágenes

| Archivo | Uso |
|---|---|
| `perfil-1080.png` | Foto de perfil de Facebook **e** Instagram (se ve en círculo; el contenido está centrado). |
| `portada-facebook-1640x624.png` | Portada de Facebook. Todo el texto cabe en la franja central que se ve en móvil. |

`banner-4400x1739.svg` / `.png`: versión mejorada del banner naranja (nombre «Chollos de Hoy», texto centrado en la franja que se ve en móvil, frase y web; el SVG usa la fuente DM Sans, así que para subirlo usa el PNG).

Fuentes editables: `perfil.html` y `portada.html` (renderizar con Playwright a 1080×1080 y 1640×624).

## Facebook

1. **Nombre de la página**: `Chollos de Hoy` (Configuración → Información de la página). Meta puede tardar unos días en aprobarlo.
2. **Nombre de usuario**: `chollosdhoy` → la página queda en `facebook.com/chollosdhoy`.
3. **Categoría**: `Sitio web de compras` (o «Tienda de compras y venta minorista»).
4. **Sitio web**: `https://chollosdhoy.com`
5. **Botón de acción**: «Enviar mensaje» → cambiar a **«Más información» / «Ver sitio web»** con `https://chollosdhoy.com`.
6. **Descripción (Información / «Presentación», máx. 255 caracteres)**:

   ```
   Chollos reales de Amazon, MediaMarkt, PcComponentes, Miravia y más. Comprobamos los precios varias veces al día y solo publicamos bajadas de verdad. Alertas gratis en Telegram: t.me/cazando_ofertas_bot
   ```

7. **Foto de perfil** y **portada**: las de arriba.

## Instagram

1. **Nombre** (el que sale en negrita, se puede buscar): `Chollos de Hoy | Ofertas`
2. **Bio (máx. 150 caracteres)**:

   ```
   🔥 Chollos reales de Amazon, MediaMarkt, PcComponentes y más
   ✅ Precios comprobados cada día
   🔔 Alertas gratis en Telegram 👇
   ```

3. **Enlaces** (Editar perfil → Enlaces; Instagram admite hasta 5):
   - `https://t.me/cazando_ofertas_bot` — título «Alertas en Telegram»
   - `https://chollosdhoy.com` — título «Todas las ofertas»
4. **Categoría** (cuenta profesional): `Sitio web de compras`.
5. **Foto de perfil**: `perfil-1080.png`.
6. **Historias destacadas** (opcional): «Cómo funciona» (qué es un chollo real, el mínimo de 30 días) y «Alertas» (cómo crear una alerta en el bot).
