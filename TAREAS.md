# Tareas pendientes

Lista viva de trabajo pendiente. Marca con `[x]` al terminar y añade la fecha.

## Contenido / Blog

- [ ] Revisar y publicar los 22 artículos en borrador (admin → Artículos → filtro Borrador; hay vista previa).
- [x] 2026-09-26 Corregir el artículo «5 productos básicos para la limpieza del hogar»: FAQ con texto de prueba («wewewe», «qeqe») y enlace a `127.0.0.1` en el primer H2.
- [x] 2026-09-26 Seed: ya no siembra artículos en `seed`//api/seed; `seed:blog` solo inserta los que falten como borrador, sin sobrescribir.
- [ ] Ampliar a 1.500+ palabras las guías que se quieran posicionar mejor.
- [ ] Créditos de fotógrafo con nombre en imágenes Unsplash (necesita API key gratuita de Unsplash; la licencia no lo exige).
- [ ] SEO del blog: JSON-LD `FAQPage` para los bloques de preguntas frecuentes.
- [ ] Aviso en el editor cuando falten título/descripción SEO o `alt` en imágenes.
- [ ] Enlazado interno blog ↔ marketplace («Guías relacionadas» / categorías).

## Marketplace (chollosdhoy.com)

- [ ] Dar de alta en Google Search Console (propiedad de dominio, TXT en el DNS) y enviar `sitemap.xml`.
- [ ] Dar de alta en Bing Webmaster (importar desde Google).
- [ ] Implementar IndexNow para avisar a Bing de productos nuevos/cambiados.
- [ ] Páginas de categoría y tienda renderizadas en servidor (`/categoria/[slug]`, `/tienda/[retailer]`).
- [ ] Agrupar variantes (una tarjeta por `parent_asin`) y mostrar las opciones en la ficha.
- [ ] Ofertas caducadas/agotadas: aviso en la ficha + alternativas en vez del botón de compra.
- [ ] Historial de precio en la ficha y «precio comprobado hace X min».
- [ ] Enlaces a crear alerta / canal de Telegram desde ficha y categorías.
- [x] Migrar `apps/chollosdehoy/src/middleware.ts` a `proxy.ts` (Next 16). 2026-09-26
- [x] Portada: quitar `force-dynamic` (contradice `revalidate = 120`). 2026-09-26

## Admin

- [x] Redes / Tarjetas: guardar los diseños en la base de datos (tarjetas, carruseles y vídeos → `design_projects`). 2026-09-26
- [x] Productos: usar `AdminSortButton` compartido y quitar el import `X` sin usar. 2026-09-26
- [ ] Unificar la carga de datos del admin (23 avisos `react-hooks/set-state-in-effect`).
- [x] 2026-09-26 Guardar título/ASIN en `affiliate_clicks` para no perder la atribución cuando se borra un producto (~9 % de clics sin producto).
- [x] 2026-09-26 Guardar user-agent en `affiliate_clicks` para poder auditar clics (los de Facebook hasta 2026-09-24 están inflados por el rastreador).

## Canales y automatización

- [ ] Facebook/Instagram: cola atascada por el bloqueo de Meta (error 368). Al desbloquear, subir `meta_post_interval_minutes` y revisar `meta_batch_size` antes de vaciar la cola.
- [ ] Miravia: `check-prices` del VPS recibe captcha al revisar fichas de Miravia; mover esa revisión al Mac (IP residencial) o quitarla del VPS.
- [ ] Miravia depende del Mac encendido; valorar salida por IP residencial desde el VPS.
- [ ] Asistente de alertas de Telegram: el botón «Sin mínimo» equivale a 15 % en alertas de categoría/marca; indicarlo en el texto.

## Infraestructura / mantenimiento

- [ ] Túnel Mac → VPS (`com.cazaofertas.vps-tunnel`) sale con código 255.
- [ ] Borrar los LaunchAgents sobrantes del Mac (`check-prices`, `flash-deals`, …): duplicarían al VPS si se reinstalan.
- [ ] Actualizar `scripts/local-cron/schedules.md` con el reparto real VPS/Mac.
- [x] Errores de lint antiguos (`prefer-const` en bot.ts, flashDeals.ts, AmazonHtmlPriceProvider.ts). 2026-09-26
