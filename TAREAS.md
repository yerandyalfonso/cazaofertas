# Tareas pendientes

Lista viva de trabajo pendiente. Marca con `[x]` al terminar y añade la fecha.

Organizada por producto: cada tarea va en la sección de lo que cambia (Blog, Marketplace, Admin, Alertas, Canales, una tienda concreta o Infraestructura). Dentro de cada sección, primero lo pendiente y después lo hecho, del más reciente al más antiguo.

- [Blog](#blog-blogchollosdhoycom)
- [Marketplace](#marketplace-chollosdhoycom)
- [Admin](#admin)
- [Alertas de usuario y bot de Telegram](#alertas-de-usuario-y-bot-de-telegram)
- [Canales (Telegram, Facebook, Instagram)](#canales-telegram-facebook-instagram)
- [Tiendas](#tiendas): [Amazon](#amazon) · [Miravia](#miravia) · [Kiabi](#kiabi) · [Carrefour](#carrefour) · [AliExpress](#aliexpress) · [PcComponentes](#pccomponentes) · [MediaMarkt](#mediamarkt)
- [Infraestructura / mantenimiento](#infraestructura--mantenimiento)
- [Descartadas](#descartadas)

## Blog (blog.chollosdhoy.com)

- [ ] Ampliar a 1.500+ palabras las guías que se quieran posicionar mejor.
- [ ] Elegir el seudónimo del autor y escribir su bio (`BLOG_AUTHOR` en `src/lib/legal.ts`).
- [ ] Datos del titular para el aviso legal (LSSI, art. 10): nombre, NIF y domicilio (`LEGAL_OWNER` en `src/lib/legal.ts`). Obligatorio al tener ingresos por afiliación.
- [ ] Email de contacto del blog (derechos de privacidad y contacto): `LEGAL_OWNER.email` en `src/lib/legal.ts`.
- [ ] SEO del blog en Google: dar de alta `blog.chollosdhoy.com` en Google Search Console (si se crea la propiedad de dominio `chollosdhoy.com` del marketplace, ya cubre el subdominio) y enviar `https://blog.chollosdhoy.com/sitemap.xml`.
- [ ] SEO del blog en Bing: dar de alta en Bing Webmaster (importar desde Google) y enviar el sitemap del blog.
- [ ] IndexNow en el blog: avisar a Bing al publicar o actualizar un artículo.
- [ ] Cambiar el dominio del blog (hoy `blog.chollosdhoy.com`) cuando haya uno nuevo. Sitios donde aparece: `NEXT_PUBLIC_SITE_URL` en el `.env.local` del VPS, el Caddyfile del VPS (`/etc/caddy/Caddyfile`), el DNS, `src/lib/site.ts` (dominio de reserva), `src/services/carrefourDeals.ts` y `apps/chollosdehoy/src/lib/guides.ts` y `NEXT_PUBLIC_BLOG_URL` del marketplace (enlaces del marketplace al blog). Después: redirección 301 del dominio viejo al nuevo, cambio de dirección en Search Console y Bing, y revisar los enlaces ya publicados en Telegram y Facebook. Antes de hacerlo, buscar `blog.chollosdhoy` en el código y en el VPS por si aparece en algún sitio más.
- [ ] Gráfico de historial de precios en la ficha (datos ya disponibles en `getPriceHistory`). *Ojo: en «Descartadas» figura «Historial de precio en la ficha» (26-09, por egress de Supabase); decidir cuál vale.*
- [x] 2026-09-30 Temas del blog: los 24 artículos publicados pasan a Hogar, Cocina, Bebé, Tecnología, Belleza, Mascotas, Ocio y Compras (cambiado en la BD). El formato ya lo da la plantilla (Guía de compra, Comparativa rápida…); elegir plantilla en el editor ya no cambia el tema.
- [x] 2026-09-30 `/sobre-nosotros`: sección «Quién escribe», visible en cuanto se rellene `BLOG_AUTHOR` en `src/lib/legal.ts`.
- [x] 2026-09-30 Aviso legal y privacidad reescritos tras revisar blogs de afiliados parecidos: resumen al inicio, afiliación de Amazon y otras tiendas, precios, cookies (no hay de publicidad ni analítica: Umami sin cookies), tabla de datos por uso, proveedores (Contabo, Francia), derechos y AEPD.
- [x] 2026-09-30 Categorías sin tope de 480: el HTML trae las 48 mejores y el resto llega por tandas de 24 desde `/api/categorias/productos` (lista de la categoría en memoria 1 min).
- [x] 2026-09-29 Rediseño de la web pública y nueva marca «Una mica de tot» (integrado en `main` y desplegado; comprobado el 30-09). Detalle en `docs/diseno-una-mica-de-tot.md`. Arreglado de paso: el filtro por categoría de Ofertas no mostraba nada (comparaba subcategoría con categoría raíz), las categorías mostraban solo las ofertas del top global (Bebé: 18 de 774) y los recuentos se cortaban en 1.000 filas.
- [x] 2026-09-26 Revisar y publicar los artículos en borrador (ya no queda ninguno: 24 publicados, 11 archivados).
- [x] 2026-09-26 Corregir el artículo «5 productos básicos para la limpieza del hogar»: FAQ con texto de prueba («wewewe», «qeqe») y enlace a `127.0.0.1` en el primer H2.
- [x] 2026-09-26 Seed: ya no siembra artículos en `seed`//api/seed; `seed:blog` solo inserta los que falten como borrador, sin sobrescribir.
- [x] 2026-09-26 SEO del blog: JSON-LD `FAQPage` para los bloques de preguntas frecuentes (desplegado 26-09).
- [x] 2026-09-26 Avisos de SEO en el editor: longitud del título y la descripción, imagen destacada y `alt` de las imágenes (desplegado; comprobado el 30-09).
- [x] 2026-09-26 Enlazado interno blog ↔ marketplace (desplegado 26-09): el artículo enlaza a la categoría de sus productos (desde el 30-09, a las ofertas del propio blog, `/categorias/<slug>`, no al marketplace), y las categorías del marketplace muestran «Guías relacionadas». Los artículos sin productos (guías de Amazon) no llevan enlace.

## Marketplace (chollosdhoy.com)

- [ ] Dar de alta en Google Search Console (propiedad de dominio, TXT en el DNS) y enviar `sitemap.xml`.
- [ ] Dar de alta en Bing Webmaster (importar desde Google).
- [ ] Implementar IndexNow para avisar a Bing de productos nuevos/cambiados.
- [ ] Opcional: ensanchar el contenido de ficha y listados para que quede alineado con la barra superior (hoy la barra usa el ancho de la portada, 1600 px).
- [x] 2026-09-30 Etiqueta de nivel máximo «Mínimo histórico» → «Chollazo» en la web (blog y marketplace), igual que en Telegram y Facebook.
- [x] 2026-09-30 MediaMarkt en la lista de tiendas del marketplace (nombre, color `--retailer-mediamarkt` y filtro por tienda).
- [x] 2026-09-27 Rediseño UI/UX del marketplace (desplegado 27-09, ver «Diseño» en `apps/chollosdehoy/README.md`): tarjetas con precio grande, anterior tachado y botón «Ver» de borde naranja (a todo el ancho si queda solo en su fila); portada con las dos mejores ofertas en horizontal; listados con cabecera compacta y una tarjeta por fila en móvil; ficha con el descuento sobre la foto, precio grande y sin avisos redundantes; barra de navegación fija en todas las páginas; filtro de precio con slider; acento naranja vivo `#f97316`; altura única de 44 px en botones y buscador.
- [x] 2026-09-27 Accesibilidad móvil: 0 zonas táctiles <44 px en todas las rutas (migas, pie, avisos, chips, paginación y títulos), 0 scroll horizontal, un h1 por página.
- [x] 2026-09-27 Cabeceras `sticky` rotas en todas las páginas: `overflow-x: hidden` en `html/body` las anulaba; cambiado a `clip`.
- [x] 2026-09-27 Precios «antes» falsos: el precio de referencia se arrastraba para siempre aunque la tienda ya no lo mostrara (p. ej. OhO sunshine 45,99 € «antes» 207,87 €). Ahora solo vale el tachado que muestra la tienda en la revisión actual o una bajada que hayamos visto (caduca a los 30 días, columna `previous_price_observed_at`, migración 0048). Los productos se corrigen solos en su siguiente revisión (`src/services/referencePrice.ts`).
- [x] 2026-09-26 Páginas de categoría, subcategoría y tienda (`/categoria/hogar[/cocina][/pagina/N]`, `/tienda/amazon`), ISR 5 min, en sitemap y enlazadas desde portada, fichas y pie.
- [x] 2026-09-26 Agrupar variantes (vista `marketplace_products`: una tarjeta por `parent_asin`, «N opciones») y opciones en la ficha.
- [x] 2026-09-26 Ofertas caducadas/agotadas/retiradas: aviso en la ficha + alternativas en vez del botón de compra (retiradas: 200 con noindex en vez de 404).
- [x] 2026-09-26 Enlaces a crear alerta / canal de Telegram desde ficha y categorías (desplegado 26-09; «Únete al grupo» apunta al grupo público @chollosdhoy, falta desplegar ese cambio). Arreglado de paso: el enlace de alerta de productos que no son de Amazon abría la alerta con una URL de Amazon.
- [x] 2026-09-26 Migrar `apps/chollosdehoy/src/middleware.ts` a `proxy.ts` (Next 16).
- [x] 2026-09-26 Portada: quitar `force-dynamic` (contradice `revalidate = 120`).

## Admin

- [ ] Carruseles: con «Modo automático» activo, lo que editas a mano en una diapositiva se pierde al reabrir el carrusel (se regenera desde el artículo). Pasaba ya antes del 30-09. Decidir si editar a mano debe apagar el modo automático o si el guardado debe respetar las ediciones.
- [x] 2026-09-30 Últimos 4 avisos `set-state-in-effect` (0 en todo el proyecto): proyecto nuevo/hidratación en los editores de tarjetas, carruseles y vídeos, y la regeneración de diapositivas, pasan al siguiente ciclo. Probado abrir, guardar, reabrir y autoguardar en los tres con proyectos de prueba (borrados después).
- [x] 2026-09-30 7 avisos `set-state-in-effect` resueltos: reinicios de estado al cambiar la plantilla o la imagen (guía de estilo, importación rápida, `SocialCardPreview`, `SocialPulseTemplate`, editor de redes, vídeos) pasan a hacerse durante el render; comentarios del blog con carga diferida.
- [x] 2026-09-30 Productos: formulario de alta/edición a `useProductForm` (estado y acciones) + `ProductFormPanel` (vista). La página pasa de 1 540 a 1 000 líneas.
- [x] 2026-09-30 Productos y Cupones partidos sin cambiar lógica: tipos y utilidades a `components/admin/products/productsAdmin.ts` y `coupons/couponsAdmin.ts`, panel «Consulta BD» a `ProductDetailPanel` y formulario de cupón a `CouponFormPanel`. Productos 1 950 → 1 540 líneas; Cupones 680 → 510.
- [x] 2026-09-30 Carga de datos del admin unificada en `useAdminLoad` (15 pantallas: listas, Operaciones, Ajustes, editores): 26 → 11 avisos `set-state-in-effect`.
- [x] 2026-09-30 Admin → Alertas (`/admin/alerts`): resumen (activas, pausadas, esperando al Mac, con fallos, usuarios), últimas 12 pasadas de `user_alert_runs` por máquina y tabla filtrable por estado, tipo, tienda y texto, con pausar/reactivar (reactivar pone a cero los fallos). Los usuarios de prueba se ocultan salvo que se marquen.
- [x] 2026-09-30 Operaciones → Resumen: tabla «Estado por tienda» (Al día / Atrasada / Parado, activos, última revisión, revisados en 24 h, sin revisar +48 h, agotados, último producto nuevo), sacada de los productos activos. No hay registro de ejecuciones de los jobs: si hace falta saber qué máquina corrió cada uno, sería una tabla nueva.
- [x] 2026-09-30 Estadísticas: tabla «Por tienda» con productos activos, clics del periodo, % de clics y clics por 100 productos (los clics de productos borrados, aparte). Arreglado también el desborde horizontal de la página con títulos largos.
- [x] 2026-09-30 Productos: aviso bajo la tienda y en «Revisar precio» (desactivado, con el motivo) cuando la tienda no se puede revisar desde el admin: «Sin revisión de precio» (Carrefour, PcComponentes, AliExpress) o «Precio: lo revisa el Mac» (MediaMarkt). Arreglado también el filtro por tienda/categoría: si cambiabas el filtro mientras cargaba la siguiente página, la recarga se descartaba y salía «Requested range not satisfiable».
- [x] 2026-09-30 Redes / Tarjetas: `api/admin/image-proxy` solo admitía Amazon, Unsplash y Supabase; las fotos de Miravia, Kiabi, Carrefour y MediaMarkt daban 400 y salían sin foto. Ahora admite sus CDNs (Carrefour solo su bucket de Google Storage y nuestro Storage).
- [x] 2026-09-30 Mejora visual del admin (skills `frontend-design` y `ui-ux-pro-max`): marco oscuro petróleo con la página activa en amarillo, tarjetas sin sombra, botones/pestañas/etiquetas sin mayúsculas (130 etiquetas en 22 archivos; no se tocaron `SocialCardPreview`, `SocialPulseTemplate`, `CarouselSlideFrame`, `ArticleStyleGuide` ni el editor del blog, que generan lo publicado), textos mínimo 12 px, foco visible, movimiento reducido y buscador de Productos en móvil (dejaba un hueco de 220 px).
- [x] 2026-09-30 Ajustes → Carrefour y MediaMarkt: secciones en admin → Ajustes (activo, descuento mínimo, páginas por listado, listados y, en MediaMarkt, vendedores externos), guardadas en `app_settings.retailer_deal_settings` (migración 0055, `src/services/retailerDealSettings.ts`); lo no guardado sigue saliendo del `.env.local` del Mac. Otra tienda con job (AliExpress, PcComponentes): sumarla a `src/lib/retailerDealJobs.ts`.
- [x] 2026-09-26 Redes / Tarjetas: guardar los diseños en la base de datos (tarjetas, carruseles y vídeos → `design_projects`).
- [x] 2026-09-26 Productos: usar `AdminSortButton` compartido y quitar el import `X` sin usar.
- [x] 2026-09-26 Guardar título/ASIN en `affiliate_clicks` para no perder la atribución cuando se borra un producto (~9 % de clics sin producto).
- [x] 2026-09-26 Guardar user-agent en `affiliate_clicks` para poder auditar clics (los de Facebook hasta 2026-09-24 están inflados por el rastreador).

## Alertas de usuario y bot de Telegram

- [ ] Test de carga de alertas (desde 2026-09-27): 100 usuarios de prueba (`users.is_test`) con 500 alertas de URL: 70 usuarios (`test_nuevos_*`) sobre 175 productos de Amazon en oferta/más vendidos que no estaban en el catálogo (se crean públicos en su primera revisión y se quedan al limpiar) y 30 (`test_catalogo_*`) sobre 76 del catálogo. Avisos «🧪 Prueba» y estadísticas cada 2 h al chat privado del bot (timer `cazaofertas-cron-alert-load-report` en el VPS; cada ejecución de user-alerts queda en `user_alert_runs`). Informe manual: `npx tsx scripts/alert-load-test/report.mts`. **Al terminar:** `npx tsx scripts/alert-load-test/cleanup.mts`, desactivar el timer del informe (`sudo systemctl disable --now cazaofertas-cron-alert-load-report.timer`) y decidir si se mantiene el ritmo nuevo de user-alerts (VPS cada 20 min, Mac cada 30 min).
- [x] 2026-09-26 Asistente de alertas de Telegram: «Sin mínimo (−15%)» en alertas de categoría/marca (desplegado 26-09).

## Canales (Telegram, Facebook, Instagram)

- [ ] Facebook/Instagram: la cola nunca se vaciaba (nadie llamaba a `maybeFlushMetaBatch` desde que existen los lotes, 22-09) y un lote fallido se perdía. Corregido y desplegado 26-09: interruptor «Publicar en Facebook/Instagram» en admin → Ajustes (arranca apagado), vaciado desde `check-prices` del VPS (`CAZAOFERTAS_META_FLUSH=1`), el lote vuelve a la cola si falla, se apaga solo ante un bloqueo 368 y los pendientes de más de 48 h se descartan. **Cuando Meta desbloquee:** activar el interruptor.
- [ ] Decidir si se quiere canal/bot de WhatsApp (estudio en `docs/estudio-whatsapp.md`).
- [x] 2026-09-30 Facebook/Instagram: texto de los lotes reescrito. Línea en blanco entre productos (Instagram los juntaba), titular «N chollos de hoy, hasta −X%», precio con tienda y aviso «con Prime», y cierre con enlace a la web (Facebook) o a la bio (Instagram).
- [x] 2026-09-28 Canal/grupo de Telegram: las ofertas se publican en el momento de detectarlas (antes, lotes cada 2 h con el precio de la detección) y se comprueba el precio justo antes de publicar (Amazon se relee si el precio tiene >10 min; no se publica si subió >2 % o está agotado).

## Tiendas

Qué tiendas corren dónde: `scripts/local-cron/schedules.md`. Registro de tiendas: `src/lib/retailers.ts`.

### Amazon

- [ ] Salida española para Amazon desde el VPS **sin depender del Mac** (hoy: relé del Mac, 27-09): fijar el CP 28001 no funciona sin iniciar sesión (Amazon responde «Sign in to update your location») y WARP también sale por Francia. Opciones: relé del Mac ampliado a amazon.es (solo con el Mac encendido), proxy residencial español de pago (Bright Data ya está soportado por `BRIGHTDATA_PROXY_*`) o dejar Amazon solo al Mac.
- [ ] Oracle Cloud «Always Free» en Madrid como segunda salida española para Amazon (detrás del relé del Mac). Cuenta creada (región eu-madrid-1), red `red-proxy` con SSH solo desde el VPS y casa. Sin capacidad: el timer `oracle-proxy-launch` del VPS reintenta cada 5 min (`scripts/oracle-proxy/launch_free_instance.py`) y avisa por Telegram con la IP. **Cuando llegue el aviso:** instalar el proxy limitado a amazon.es, conectarlo por SSH desde el VPS, añadirlo a `AMAZON_EGRESS` y desactivar el timer.
- [ ] Revisar desde el Mac los ~338 productos de Amazon marcados agotados (muchos eran falsos «agotado»); se corrigen solos en su siguiente revisión.
- [ ] Router Digi (TP-Link EX520v ESDIGI): el firmware trae OpenVPN pero lo oculta; no sirve como salida española. Conexión Plus (1 €/mes) activada el 27-09: cancelarla si no se usa.
- [x] 2026-09-28 «Oferta Prime»: se lee el precio de oferta Prime que Amazon muestra por defecto (antes el «Precio sin oferta») y se etiqueta «Prime» en web y Telegram, con el precio sin Prime (`products.prime_only`, `regular_price`, migración 0054). Alertas de URL: solo bajadas ≥2 % y ≥0,10 €, sin repetir la misma (migración 0053).
- [x] 2026-09-27 Lector de Amazon: (1) el VPS está en Francia y Amazon.es quita el precio de lo que no envía allí; lo leíamos como agotado. Ahora se detecta «Enviar a Francia» y esas fichas se omiten (no se marcan agotadas); las revisa el Mac. (2) «Temporalmente sin stock. Realiza tu pedido» y fichas con botón de compra cuentan como disponibles. (3) Productos padre con variantes: precio mínimo del rango, sin «antes». (4) Caja de compra vacía = sin oferta.
- [x] 2026-09-27 El contador de fallos por ASIN desactivaba productos que el VPS no veía desde Francia («El proveedor no devolvió precio»): 35 desactivados el 26–27/09, de ellos 27 estaban bien en España y se reactivaron desde el Mac. Ahora esas omisiones no cuentan como fallo ni avisan.

### Miravia

- [ ] Productos de Miravia con título «Producto Miravia <id>»: importador corregido (2026-09-26). El 26-09 se lanzó la corrección de los 196 desde el VPS por WARP (`systemd-run --unit=fix-miravia-titles`, una ficha cada 45 s); comprobar con `journalctl -u fix-miravia-titles`.
- [ ] Descripciones de Miravia: el scraper ya lee el bloque «Descripción del artículo»; `check-prices` las va rellenando al revisar cada producto (26-09: 0 de 663).
- [x] 2026-09-30 `RETAIL_PRICE_CHECK_SKIP_RETAILERS` había desaparecido del `.env.local` del VPS (reescrito el 27-09 23:22; solo quedaba en `.env.local.bak-202609262317`), así que el VPS volvía a revisar Miravia. Restaurada como `miravia,mediamarkt` (copia previa en `.env.local.bak-<fecha>`).
- [x] 2026-09-26 Miravia: `check-prices` del VPS recibe captcha al revisar fichas de Miravia y esas fichas acaparaban el lote retail. Corregido y desplegado 26-09: con captcha el producto rota, y el VPS se salta Miravia con `RETAIL_PRICE_CHECK_SKIP_RETAILERS=miravia` (la revisa el Mac).
- [x] 2026-09-26 Salida no bloqueada desde el VPS para Miravia, gratis: Cloudflare WARP en **modo proxy** (`127.0.0.1:40000`, no toca rutas ni DNS) y `MIRAVIA_PROXY_URL` en el VPS. Directo da captcha; por WARP carga. `check-prices` del VPS vuelve a revisar Miravia.

### AliExpress

- [x] 2026-09-30 Chromium de Playwright instalado en el Mac (`npx playwright install chromium`): las alertas de AliExpress (`withBrowserPage`) fallaban al arrancar en el Mac. Probado con 2 fichas reales.

### Kiabi

- [ ] Descripciones de Kiabi (26-09: 0 de 81): falta que `check-prices` las rellene, como ya hace con Miravia.

### Carrefour

- [x] 2026-09-30 Productos nuevos del job de ofertas (Carrefour y MediaMarkt) sin «Chollazo» automático: se puntuaban con su precio actual como mínimo, así que todo lo nuevo salía como máximo nivel. Ahora, sin historial, el nivel depende solo del descuento. Los avisos del job ya estaban activos (el LaunchAgent no lleva `--no-notify`).
- [x] Alertas por URL con Google Chrome con ventana desde el Mac (Cloudflare bloquea headless), mismo id que las alertas (`skuId`) y fotos subidas a Supabase (commits hasta `539288e`).

### PcComponentes

Alertas de usuario por URL (`user-alerts-residential`) y job de ofertas `pccomponentes-deals`, los dos desde el Mac con Google Chrome con ventana minimizada, como Carrefour. Código en `src/providers/browser/pccomponentes*.ts` y `src/services/pccomponentesDeals.ts`; el Chrome con ventana compartido está en `src/providers/browser/headedChrome.ts`.

- [ ] Vigilar la calidad de los avisos: el «descuento» es sobre el PVPR del fabricante, que suele estar inflado (Galaxy Tab A11 a 148 € «−63 %» sobre 399 €). Si el canal se llena de falsos chollos, subir el mínimo o bajar de nivel las ofertas de PcComponentes.
- [x] 2026-09-30 Avisos del job activados (`PCCOMPONENTES_DEALS_NOTIFY=1` en el Mac) con descuento mínimo del 30 % (admin → Ajustes). Prueba real con 2 productos (auriculares Soundcore Space Q45 −60 % y Galaxy Tab A11 −63 %): creados, avisados en el canal y con la ficha del marketplace bien. Con el 30 %, 74 de 236 productos pasan el filtro.
- [x] 2026-09-30 Slug de las fichas: repetía el título dos veces (el id de PcComponentes es el slug de su URL). Ahora título + hash corto (`…-pcc-1bc81ca0`); los 2 productos ya avisados conservan el slug viejo para no romper los enlaces publicados.
- [ ] Revisar tras las primeras corridas reales (log `~/Library/Logs/cazaofertas/pccomponentes-deals.log`) cuántos productos entran y si las categorías se asignan bien fuera de Tecnología/Informática.
- [ ] Afiliación: darse de alta en el programa de PcComponentes (si está en Awin) y poner `AWIN_MID_PCCOMPONENTES` en el `.env.local` del VPS (ver MediaMarkt: el código ya está listo).
- [x] 2026-09-30 Ficha con Google Chrome con ventana (antes Chromium headless, que Cloudflare bloquea en la ficha y que además no estaba instalado en el Mac: toda alerta fallaba al arrancar). Espera a que Cloudflare resuelva el reto («Un momento…», hasta 15 s); ~2–4 s por ficha. Probado con 3 fichas reales, incluida una con variantes (`ProductGroup`) y una inexistente («no encontrado»).
- [x] 2026-09-30 Precio tachado: el PVPR que muestra la ficha (`#pdp-price-original`, «PVPR 749,99€»); el JSON-LD solo trae el precio actual.
- [x] 2026-09-30 URL guardada sin query, hash ni `/` final (`normalizePcComponentesProductUrl`). El id ya salía limpio (el slug de la ruta), así que no había productos duplicados, pero la URL se guardaba con `?utm…`.
- [x] 2026-09-30 Fotos de `img.pccomponentes.com`: cargan desde el Mac y desde el VPS (Telegram puede mostrarlas sin subirlas a Supabase, al contrario que Carrefour).
- [x] 2026-09-30 Job `pccomponentes-deals` (Mac, 09:45 y 17:45; LaunchAgent instalado el 30-09). Lee las tarjetas de 6 listados de categoría (~40 por página, 2 páginas): precio, PVPR tachado (`crossedPrice`), marca, categoría, vendedor y foto, sin abrir fichas. Descarta vendedores externos y reacondicionados («Replay…»: PcComponentes los marca `condition=new`, se detectan por título). Configurable en admin → Ajustes (`retailer_deal_settings.pccomponentes`) o con `PCCOMPONENTES_DEALS_*`. Prueba en seco: 236 productos, 145 con descuento, 32 de terceros descartados. No necesita despliegue: el VPS ya conocía la tienda.

### MediaMarkt

Ficha y listados renderizados en servidor: `fetch` simple, sin navegador. Precio, tachado, disponibilidad y vendedor salen del estado Apollo de la página (`CofrPriceFeature`, `CofrOnlineStatusFeature`); título, marca, imagen y EAN del JSON-LD. Código en `src/providers/retail/mediamarkt/` y `src/services/mediamarktDeals.ts`. **Solo desde el Mac:** a la IP del VPS le da 403.

- [ ] Decidir si interesan las ofertas de vendedores externos (marketplace): hoy se descartan (9 de 99 en la primera prueba); se activan con `MEDIAMARKT_DEALS_INCLUDE_MARKETPLACE=1`.
- [ ] Afiliación: darse de alta como publisher en Awin y solicitar el programa de MediaMarkt España. Con la aprobación, poner en el `.env.local` del VPS `AWIN_PUBLISHER_ID` (id de afiliado) y `AWIN_MID_MEDIAMARKT` (id del anunciante) y reiniciar las dos webs: todos los enlaces de compra de MediaMarkt pasan a `awin1.com/cread.php?…` sin tocar productos (`src/lib/awin.ts` y su copia en el marketplace). Vale para cualquier tienda con `AWIN_MID_<TIENDA>`.
- [ ] Usar el EAN (`gtin`, ya se lee) para cruzar el mismo producto entre tiendas (p. ej. con Amazon) y comparar precios.
- [x] 2026-09-30 Provider de ficha (`scrapeMediaMarktProductPage`): id = número final de la URL (sin query ni hash), prefijo `MM-`. Si la ficha redirige a otro producto (ofertas de marketplace retiradas) da «producto no encontrado»: su página traía el precio del id pedido en las recomendaciones y se habría guardado el de otro producto.
- [x] 2026-09-30 Alertas de usuario por URL: el bot deja la alerta en espera (`requiresResidentialIp`) y la completa `user-alerts-residential` del Mac (ahora PcComponentes, Carrefour y MediaMarkt, 10 por corrida). También en la revisión de precios del catálogo (`retailPriceCheck`), que marca agotado si la tienda lo da como no disponible; el VPS se la salta (`RETAIL_PRICE_CHECK_SKIP_RETAILERS=miravia,mediamarkt`).
- [x] 2026-09-30 Job `mediamarkt-deals` (Mac, 08:15, 12:15, 16:15 y 20:15): rebajas ≥15 % de 8 listados de categoría (3 páginas de 12), sin abrir fichas; primero bajadas de productos ya guardados y luego nuevos, hasta 20 por corrida. Prueba en seco: 99 productos, 60 con descuento, categorías bien asignadas. Configurable con `MEDIAMARKT_DEALS_*` y `MEDIAMARKT_FEED_URLS`.
- [x] 2026-09-30 MediaMarkt en el bot, el aviso legal y la lista de tiendas del marketplace.
- [x] 2026-09-30 Desplegado en el VPS e instalado el job en el Mac. Corrida real de prueba (3 productos, sin avisos): se crean bien y la ficha del marketplace muestra «30,99 € en MediaMarkt» con el botón a mediamarkt.es.
- [x] 2026-09-30 Avisos del job activados (`MEDIAMARKT_DEALS_NOTIFY=1` en el `.env.local` del Mac); pasan el mismo filtro de puntuación del canal que Amazon.

## Infraestructura / mantenimiento

- [x] 2026-09-27 Relé del Mac instalado (`scripts/local-cron/install-miravia-relay.sh`) y ampliado a amazon.es: el VPS sale a Amazon por la IP española del Mac (`AMAZON_EGRESS`) y a Miravia como respaldo de WARP.
- [x] 2026-09-26 Túnel Mac → VPS con código 255 (y `check-prices` con código 1): era una caída de red del Mac, no un fallo. El túnel ya tiene `ServerAliveInterval` y `KeepAlive`, así que launchd lo relanza al volver la red.
- [x] 2026-09-26 Actualizar `scripts/local-cron/schedules.md` con el reparto real VPS/Mac. Los LaunchAgents del Mac que repiten jobs del VPS se quedan: es intencionado (IP residencial = más productos y menos bloqueos).
- [x] 2026-09-26 Errores de lint antiguos (`prefer-const` en bot.ts, flashDeals.ts, AmazonHtmlPriceProvider.ts).

## Descartadas

- Historial de precio en la ficha: consume demasiados recursos (egress de Supabase). 2026-09-26
- Créditos de fotógrafo de Unsplash: la licencia no los exige y afean el final del artículo. 2026-09-26
