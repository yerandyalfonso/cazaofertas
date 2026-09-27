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
- [ ] Productos de Miravia con título «Producto Miravia <id>»: importador corregido (2026-09-26). El 26-09 se lanzó la corrección de los 196 desde el VPS por WARP (`systemd-run --unit=fix-miravia-titles`, una ficha cada 45 s); comprobar con `journalctl -u fix-miravia-titles`.
- [x] 2026-09-26 Agrupar variantes (vista `marketplace_products`: una tarjeta por `parent_asin`, «N opciones») y opciones en la ficha.
- [x] 2026-09-26 Ofertas caducadas/agotadas/retiradas: aviso en la ficha + alternativas en vez del botón de compra (retiradas: 200 con noindex en vez de 404).
- [x] 2026-09-26 Enlaces a crear alerta / canal de Telegram desde ficha y categorías (desplegado 26-09; «Únete al grupo» apunta al grupo público @chollosdhoy, falta desplegar ese cambio). Arreglado de paso: el enlace de alerta de productos que no son de Amazon abría la alerta con una URL de Amazon.
- [x] Migrar `apps/chollosdehoy/src/middleware.ts` a `proxy.ts` (Next 16). 2026-09-26
- [x] Portada: quitar `force-dynamic` (contradice `revalidate = 120`). 2026-09-26

- [x] 2026-09-27 Rediseño UI/UX del marketplace (desplegado 27-09, ver «Diseño» en `apps/chollosdehoy/README.md`): tarjetas con precio grande, anterior tachado y botón «Ver» de borde naranja (a todo el ancho si queda solo en su fila); portada con las dos mejores ofertas en horizontal; listados con cabecera compacta y una tarjeta por fila en móvil; ficha con el descuento sobre la foto, precio grande y sin avisos redundantes; barra de navegación fija en todas las páginas; filtro de precio con slider; acento naranja vivo `#f97316`; altura única de 44 px en botones y buscador.
- [x] 2026-09-27 Accesibilidad móvil: 0 zonas táctiles <44 px en todas las rutas (migas, pie, avisos, chips, paginación y títulos), 0 scroll horizontal, un h1 por página.
- [x] 2026-09-27 Cabeceras `sticky` rotas en todas las páginas: `overflow-x: hidden` en `html/body` las anulaba; cambiado a `clip`.
- [x] 2026-09-27 Precios «antes» falsos: el precio de referencia se arrastraba para siempre aunque la tienda ya no lo mostrara (p. ej. OhO sunshine 45,99 € «antes» 207,87 €). Ahora solo vale el tachado que muestra la tienda en la revisión actual o una bajada que hayamos visto (caduca a los 30 días, columna `previous_price_observed_at`, migración 0048). Los productos se corrigen solos en su siguiente revisión (`src/services/referencePrice.ts`).
- [ ] Opcional: ensanchar el contenido de ficha y listados para que quede alineado con la barra superior (hoy la barra usa el ancho de la portada, 1600 px).
- [ ] Decidir si se quiere canal/bot de WhatsApp (estudio en `docs/estudio-whatsapp.md`).

- [ ] Descripciones de Miravia: el scraper ya lee el bloque «Descripción del artículo»; `check-prices` las va rellenando al revisar cada producto (26-09: 0 de 663). Kiabi (0 de 81) sigue pendiente.

## Admin

- [x] Redes / Tarjetas: guardar los diseños en la base de datos (tarjetas, carruseles y vídeos → `design_projects`). 2026-09-26
- [x] Productos: usar `AdminSortButton` compartido y quitar el import `X` sin usar. 2026-09-26
- [ ] Unificar la carga de datos del admin (26 avisos `react-hooks/set-state-in-effect` a 26-09).
- [x] 2026-09-26 Guardar título/ASIN en `affiliate_clicks` para no perder la atribución cuando se borra un producto (~9 % de clics sin producto).
- [x] 2026-09-26 Guardar user-agent en `affiliate_clicks` para poder auditar clics (los de Facebook hasta 2026-09-24 están inflados por el rastreador).

## Canales y automatización

- [ ] Facebook/Instagram: la cola nunca se vaciaba (nadie llamaba a `maybeFlushMetaBatch` desde que existen los lotes, 22-09) y un lote fallido se perdía. Corregido y desplegado 26-09: interruptor «Publicar en Facebook/Instagram» en admin → Ajustes (arranca apagado), vaciado desde `check-prices` del VPS (`CAZAOFERTAS_META_FLUSH=1`), el lote vuelve a la cola si falla, se apaga solo ante un bloqueo 368 y los pendientes de más de 48 h se descartan. **Cuando Meta desbloquee:** activar el interruptor.
- [x] 2026-09-26 Miravia: `check-prices` del VPS recibe captcha al revisar fichas de Miravia y esas fichas acaparaban el lote retail. Corregido y desplegado 26-09: con captcha el producto rota, y el VPS se salta Miravia con `RETAIL_PRICE_CHECK_SKIP_RETAILERS=miravia` (la revisa el Mac).
- [x] 2026-09-26 Salida no bloqueada desde el VPS para Miravia, gratis: Cloudflare WARP en **modo proxy** (`127.0.0.1:40000`, no toca rutas ni DNS) y `MIRAVIA_PROXY_URL` en el VPS. Directo da captcha; por WARP carga. `check-prices` del VPS vuelve a revisar Miravia.
- [x] 2026-09-26 Asistente de alertas de Telegram: «Sin mínimo (−15%)» en alertas de categoría/marca (desplegado 26-09).

- [ ] Test de carga de alertas (desde 2026-09-27): 100 usuarios de prueba (`users.is_test`) con 500 alertas de URL: 70 usuarios (`test_nuevos_*`) sobre 175 productos de Amazon en oferta/más vendidos que no estaban en el catálogo (se crean públicos en su primera revisión y se quedan al limpiar) y 30 (`test_catalogo_*`) sobre 76 del catálogo. Avisos «🧪 Prueba» y estadísticas cada 2 h al chat privado del bot (timer `cazaofertas-cron-alert-load-report` en el VPS; cada ejecución de user-alerts queda en `user_alert_runs`). Informe manual: `npx tsx scripts/alert-load-test/report.mts`. **Al terminar:** `npx tsx scripts/alert-load-test/cleanup.mts`, desactivar el timer del informe (`sudo systemctl disable --now cazaofertas-cron-alert-load-report.timer`) y decidir si se mantiene el ritmo nuevo de user-alerts (VPS cada 20 min, Mac cada 30 min).

- [x] 2026-09-27 Lector de Amazon: (1) el VPS está en Francia y Amazon.es quita el precio de lo que no envía allí; lo leíamos como agotado. Ahora se detecta «Enviar a Francia» y esas fichas se omiten (no se marcan agotadas); las revisa el Mac. (2) «Temporalmente sin stock. Realiza tu pedido» y fichas con botón de compra cuentan como disponibles. (3) Productos padre con variantes: precio mínimo del rango, sin «antes». (4) Caja de compra vacía = sin oferta.
- [ ] Salida española para Amazon desde el VPS **sin depender del Mac** (hoy: relé del Mac, 27-09): fijar el CP 28001 no funciona sin iniciar sesión (Amazon responde «Sign in to update your location») y WARP también sale por Francia. Opciones: relé del Mac ampliado a amazon.es (solo con el Mac encendido), proxy residencial español de pago (Bright Data ya está soportado por `BRIGHTDATA_PROXY_*`) o dejar Amazon solo al Mac.
- [ ] Revisar desde el Mac los ~338 productos de Amazon marcados agotados (muchos eran falsos «agotado»); se corrigen solos en su siguiente revisión.

- [x] 2026-09-27 El contador de fallos por ASIN desactivaba productos que el VPS no veía desde Francia («El proveedor no devolvió precio»): 35 desactivados el 26–27/09, de ellos 27 estaban bien en España y se reactivaron desde el Mac. Ahora esas omisiones no cuentan como fallo ni avisan.
- [ ] Router Digi (TP-Link EX520v ESDIGI): el firmware trae OpenVPN pero lo oculta; no sirve como salida española. Conexión Plus (1 €/mes) activada el 27-09: cancelarla si no se usa.

## Infraestructura / mantenimiento

- [x] 2026-09-27 Relé del Mac instalado (`scripts/local-cron/install-miravia-relay.sh`) y ampliado a amazon.es: el VPS sale a Amazon por la IP española del Mac (`AMAZON_EGRESS`) y a Miravia como respaldo de WARP.

- [x] 2026-09-26 Túnel Mac → VPS con código 255 (y `check-prices` con código 1): era una caída de red del Mac, no un fallo. El túnel ya tiene `ServerAliveInterval` y `KeepAlive`, así que launchd lo relanza al volver la red.
- [x] 2026-09-26 Actualizar `scripts/local-cron/schedules.md` con el reparto real VPS/Mac. Los LaunchAgents del Mac que repiten jobs del VPS se quedan: es intencionado (IP residencial = más productos y menos bloqueos).
- [x] Errores de lint antiguos (`prefer-const` en bot.ts, flashDeals.ts, AmazonHtmlPriceProvider.ts). 2026-09-26

## Descartadas

- Historial de precio en la ficha: consume demasiados recursos (egress de Supabase). 2026-09-26
- Créditos de fotógrafo de Unsplash: la licencia no los exige y afean el final del artículo. 2026-09-26
