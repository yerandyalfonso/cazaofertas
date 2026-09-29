# Diseño de «Una mica de tot»

Guía de la web pública (`src/app/(site)`) tras el rediseño de septiembre de 2026.
La web es **un blog** de experiencias, recomendaciones y comparativas; las
ofertas y las categorías son secciones de apoyo. La marca antigua (CazaOferta)
se mantiene solo en Telegram, Facebook, la etiqueta de afiliado, el dominio y
el panel de administración.

## Marca

- **Nombre:** «Una mica de tot» (`BLOG_NAME` en `src/lib/blog-brand.ts`; `SITE_NAME` apunta a él).
- **Logo (variante E3):** icono · separador fino · «UNA MICA DE» en versalitas espaciadas sobre «tot» en Fraunces. Componente `src/components/blog/BlogLogo.tsx`, en la barra de navegación de todas las páginas.
- **Icono:** vectorizado del original (vtracer).
  - `public/brand/una-mica-de-tot-mark.svg`: trazo fino, para tamaños grandes.
  - `public/brand/una-mica-de-tot-mark-sm.svg`: trazo grueso, para la barra y el favicon (legible a 40–48 px).
  - `public/brand/una-mica-de-tot-horizontal.svg`: logo horizontal para redes o documentos (el texto usa Manrope).
  - `src/lib/logo-mark-paths.ts`: trazos del icono de trazo grueso, generados desde el SVG. Si cambia el SVG, regenerarlo.
- **Animación del logo:** al pasar el ratón cada pieza del icono se dibuja en verde (trazo recortado a la forma, escalonado de arriba abajo) y después se escribe el nombre de izquierda a derecha. CSS `.logo-draw` / `.logo-write` en `globals.css`; respeta `prefers-reduced-motion`.
- **Favicon:** `src/app/icon.tsx`, a partir del icono de trazo grueso.

## Color

| Uso | Valor |
|---|---|
| Fondo papel | `#f2f4f6` (`--paper`) |
| Tinta (texto) | `#12161c` (`--ink`) |
| Marca (logo) | `#2f3a45` |
| Acento | `teal-800` `#115e59` (etiquetas, enlaces, progreso, animación del logo) |
| Descuento | etiqueta oscura (`bg-ink`) con «−22 %» |
| Imágenes de producto | siempre sobre blanco |

## Tipografía

Fraunces (titulares) + Manrope (texto). Escala de 7 pasos:

| px | Uso |
|---|---|
| 12 | Etiquetas en mayúsculas, botones, «Ahorras…» (nada por debajo de 12) |
| 14 | Migas, firma, extractos, precio tachado |
| 16 | Interfaz, puntos de listas, FAQ |
| 18 | Cuerpo de artículo, títulos de tarjeta |
| 24 | H3, precio, cita destacada |
| 36 | H2 (30 en móvil) |
| 60 | Título de artículo (36 en móvil) |

Excepción: «UNA MICA DE» del logo en móvil, a 10 px.

## Lenguaje

- «Oferta», nunca «chollo». «Mínimo histórico» en vez de «Chollazo».
- Botón principal: «Alertas de precio» (Telegram).
- Sin jerga interna («deal score»).

## Cabecera (todas las páginas)

1. **Franja superior** (`TopStrip`): fecha y el último artículo. Se cierra y reaparece con el siguiente artículo.
2. **Barra fija**: logo, Blog · Ofertas, buscador (lupa, ⌘K) y «Alertas de precio». Categorías no está en el menú: se llega desde la portada, Ofertas, el pie y las migas.
3. **Temas del blog** (`TopicsNav`): categorías de los artículos, enlazan a `/blog?tema=…`.

El **buscador** (`SiteSearch` + `/api/search`) busca en artículos y ofertas activas. El panel se monta en `<body>` con un portal: la cabecera usa `backdrop-blur`, que atrapa los hijos `fixed`.

## Páginas

- **Portada:** titular del blog, artículo destacado + rejilla, columna de «Ofertas recomendadas», «Mayores descuentos», «Ofertas por sección», alerta de Telegram, «Recién rebajado», «Compra por categoría» (iconos lucide) y «Sobre el blog».
- **Blog (`/blog`):** scroll infinito, filtro por tema.
- **Artículo:** barra de progreso bajo la cabecera, índice lateral (H2, a partir de 3), firma (autor + fecha), letra capital, tabla comparativa opcional (bloque «Tabla» del editor), pros/contras, «Sigue leyendo» y comentarios al final. Las menciones a «CazaOferta» y los créditos «Imagen: Unsplash» del contenido guardado se limpian al mostrar (`src/services/blog.ts`).
- **Ofertas:** barra de filtros fija (categorías, descuento mínimo, «Solo precios más bajos»), tarjetas en 4 columnas, carga progresiva de 24 en 24.
- **Categorías:** listado con iconos y recuentos reales; cada categoría con cabecera e icono, subcategorías en pestañas, «Del blog sobre…» y ofertas de esa categoría (`getCategoryProducts`).
- **Ficha de producto:** descuento + categoría, precio grande con «Ahorras…», descripción de Amazon sin emojis (títulos en mayúsculas → negrita, líneas cortas → lista con check, líneas «…:» / «…?» → subtítulo), precio actual y disponibilidad, «Lo mencionamos en».
- **Sobre el blog** (`/sobre-nosotros`), **404** con cabecera, pie y últimos artículos.

## Datos y rendimiento

- `getCategoryShowcases` lee todo el catálogo por páginas de 1.000 (límite de Supabase) y se cachea 10 min.
- `getPublishedArticlesCached` (5 min) alimenta temas, buscador, franja, «Sigue leyendo» y «Lo mencionamos en».
