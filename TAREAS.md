# Tareas pendientes

Lista viva de trabajo pendiente. Marca con `[x]` al terminar y añade la fecha.

## Contenido / Blog

- [x] 2026-09-26 Revisar y publicar los artículos en borrador (ya no queda ninguno: 24 publicados, 11 archivados).
- [x] 2026-09-26 Corregir el artículo «5 productos básicos para la limpieza del hogar»: FAQ con texto de prueba («wewewe», «qeqe») y enlace a `127.0.0.1` en el primer H2.
- [x] 2026-09-26 Seed: ya no siembra artículos en `seed`//api/seed; `seed:blog` solo inserta los que falten como borrador, sin sobrescribir.
- [ ] Ampliar a 1.500+ palabras las guías que se quieran posicionar mejor.
- [x] 2026-09-26 SEO del blog: JSON-LD `FAQPage` para los bloques de preguntas frecuentes (desplegado 26-09).
- [x] 2026-09-26 Avisos de SEO en el editor: longitud del título y la descripción, imagen destacada y `alt` de las imágenes (falta desplegar).
- [x] 2026-09-26 Enlazado interno blog ↔ marketplace (desplegado 26-09): el artículo enlaza a la categoría del marketplace de sus productos, y las categorías del marketplace muestran «Guías relacionadas». Los artículos sin productos (guías de Amazon) no llevan enlace.

## Marketplace (chollosdhoy.com)

- [ ] Dar de alta en Google Search Console (propiedad de dominio, TXT en el DNS) y enviar `sitemap.xml`.
- [ ] Dar de alta en Bing Webmaster (importar desde Google).
- [ ] Implementar IndexNow para avisar a Bing de productos nuevos/cambiados.
- [x] 2026-09-26 Páginas de categoría, subcategoría y tienda (`/categoria/hogar[/cocina][/pagina/N]`, `/tienda/amazon`), ISR 5 min, en sitemap y enlazadas desde portada, fichas y pie.
- [ ] Productos de Miravia con título «Producto Miravia <id>»: importador corregido (2026-09-26); quedan 196 por corregir (26-09; ese día Miravia daba captcha también desde el Mac, reintentar) con `scripts/fix-miravia-titles.ts --apply --delay=45` (Miravia da captcha si se va rápido).
- [x] 2026-09-26 Agrupar variantes (vista `marketplace_products`: una tarjeta por `parent_asin`, «N opciones») y opciones en la ficha.
- [x] 2026-09-26 Ofertas caducadas/agotadas/retiradas: aviso en la ficha + alternativas en vez del botón de compra (retiradas: 200 con noindex en vez de 404).
- [x] 2026-09-26 Enlaces a crear alerta / canal de Telegram desde ficha y categorías (desplegado 26-09; «Únete al grupo» apunta al grupo público @chollosdhoy, falta desplegar ese cambio). Arreglado de paso: el enlace de alerta de productos que no son de Amazon abría la alerta con una URL de Amazon.
- [x] Migrar `apps/chollosdehoy/src/middleware.ts` a `proxy.ts` (Next 16). 2026-09-26
- [x] Portada: quitar `force-dynamic` (contradice `revalidate = 120`). 2026-09-26

## Admin

- [x] Redes / Tarjetas: guardar los diseños en la base de datos (tarjetas, carruseles y vídeos → `design_projects`). 2026-09-26
- [x] Productos: usar `AdminSortButton` compartido y quitar el import `X` sin usar. 2026-09-26
- [ ] Unificar la carga de datos del admin (26 avisos `react-hooks/set-state-in-effect` a 26-09).
- [x] 2026-09-26 Guardar título/ASIN en `affiliate_clicks` para no perder la atribución cuando se borra un producto (~9 % de clics sin producto).
- [x] 2026-09-26 Guardar user-agent en `affiliate_clicks` para poder auditar clics (los de Facebook hasta 2026-09-24 están inflados por el rastreador).

## Canales y automatización

- [ ] Facebook/Instagram: la cola nunca se vaciaba (nadie llamaba a `maybeFlushMetaBatch` desde que existen los lotes, 22-09) y un lote fallido se perdía. Corregido y desplegado 26-09: interruptor «Publicar en Facebook/Instagram» en admin → Ajustes (arranca apagado), vaciado desde `check-prices` del VPS (`CAZAOFERTAS_META_FLUSH=1`), el lote vuelve a la cola si falla, se apaga solo ante un bloqueo 368 y los pendientes de más de 48 h se descartan. **Cuando Meta desbloquee:** activar el interruptor.
- [x] 2026-09-26 Miravia: `check-prices` del VPS recibe captcha al revisar fichas de Miravia y esas fichas acaparaban el lote retail. Corregido y desplegado 26-09: con captcha el producto rota, y el VPS se salta Miravia con `RETAIL_PRICE_CHECK_SKIP_RETAILERS=miravia` (la revisa el Mac).
- [ ] Miravia depende del Mac encendido; valorar salida por IP residencial desde el VPS.
- [x] 2026-09-26 Asistente de alertas de Telegram: «Sin mínimo (−15%)» en alertas de categoría/marca (desplegado 26-09).

## Infraestructura / mantenimiento

- [x] 2026-09-26 Túnel Mac → VPS con código 255 (y `check-prices` con código 1): era una caída de red del Mac, no un fallo. El túnel ya tiene `ServerAliveInterval` y `KeepAlive`, así que launchd lo relanza al volver la red.
- [x] 2026-09-26 Actualizar `scripts/local-cron/schedules.md` con el reparto real VPS/Mac. Los LaunchAgents del Mac que repiten jobs del VPS se quedan: es intencionado (IP residencial = más productos y menos bloqueos).
- [x] Errores de lint antiguos (`prefer-const` en bot.ts, flashDeals.ts, AmazonHtmlPriceProvider.ts). 2026-09-26

## Descartadas

- Historial de precio en la ficha: consume demasiados recursos (egress de Supabase). 2026-09-26
- Créditos de fotógrafo de Unsplash: la licencia no los exige y afean el final del artículo. 2026-09-26
