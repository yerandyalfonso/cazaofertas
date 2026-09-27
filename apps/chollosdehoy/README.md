# Chollos de Hoy — Marketplace

App Next.js independiente para **chollosdehoy.com**. Comparte la misma base Supabase que CazaOfertas pero con UI propia orientada a ofertas.

## Desarrollo local

```bash
# Desde la raíz del monorepo
npm run setup:chollos-env   # una vez: copia Supabase desde .env.local raíz
npm run dev:chollos         # http://localhost:3001

# O las dos plataformas a la vez:
npm run dev:all             # CazaOfertas :3000 + Chollos :3001
```

## Despliegue

Se despliega en el VPS (no en Vercel) con el script de la raíz del repo, después de hacer `git push` de `main`:

```bash
./deploy.sh chollos   # solo Chollos de Hoy (build + restart + healthcheck en :3001)
./deploy.sh           # las dos apps
```

Dominio en producción: **chollosdhoy.com**.

## Funcionalidades

- **Paginación** server-side (24 ofertas/página) vía `GET /api/ofertas`
- **Hero por categorías** con imágenes de la taxonomía compartida
- **Cupones** en página dedicada `/cupones` (por tienda, vigencia)
- Script esqueleto: `npm run coupons:discover` (detección automática Fase 2)
- Filtros, grid/lista, sidebar de top chollos
- Filtro de precio con slider de doble tirador (`PriceRangeSlider`, escala por tramos 0–1000 € y «sin límite»); filtros en la URL
- Barra de navegación fija en todas las páginas (`MarketplaceHeader` en portada, `SiteHeader` en el resto)

## Diseño

Identidad fija: neutros cálidos (fondo `#faf7f4`, texto `#1c1917`), DM Sans, degradado ámbar → naranja (`#f59e0b → #ea580c`) en etiquetas de descuento y botones rellenos. Oferta flash en rojo.

**Tokens** (`src/app/globals.css`, tres capas: primitivo → semántico → componente, expuestos con `@theme`). En componentes usa siempre las utilidades (`text-ink`, `text-muted`, `bg-surface`, `border-line`, `text-primary`, `text-vivid`, `bg-vivid`, `rounded-card`…), nunca hex ni `var()` sueltos.

| Token | Valor | Uso |
|---|---|---|
| `--primary` | `#b45309` | Texto en color (enlaces, «Ahorras X €»); cumple AA |
| `--accent-vivid` → `text-vivid`/`bg-vivid` | `#f97316` | Iconos, contadores, filtros activos, página actual |
| `--btn-outline-color` | `--accent-vivid` | Borde y texto del botón «Ver» / «Ver en tienda» |
| `--cta-bg`, `--badge-discount-bg` | degradado | Botón relleno y etiqueta de descuento |
| `--control-height` | 44 px | Altura única de botones y buscadores |

Decisiones conscientes por debajo de AA (no «arreglarlas»): texto blanco sobre el lado ámbar del degradado, texto blanco pequeño sobre `#f97316`, y el texto naranja del botón de borde (2,8:1).

**Componentes y clases**

- `ProductCard` — prop `layout`: `vertical` (rejilla), `horizontal` (las dos primeras de la portada) y `responsive` (horizontal en móvil, vertical desde `sm`; listados). Precio actual `text-2xl` extrabold + anterior tachado. Botón `btn-outline-gradient`: si cabe va al lado del precio; si baja solo a su fila ocupa todo el ancho (precio `grow-[9999]`, botón `grow`).
- `FillImage` — foto `object-contain` sobre fondo blanco ocupando toda su zona.
- `SiteHeader` — barra fija (marca + buscador `next/form` a `/?q=` + Cupones), ancho `max-w-[1600px]` como la portada.
- `PriceRangeSlider` — dos `input range` superpuestos; aplica al soltar (puntero o teclado).
- `TelegramCta` — «Crear alerta» y «Grupo de Telegram» como botones compactos.
- Clases: `.btn` (altura `--control-height`), `.btn-primary` (relleno, 19 px/700), `.btn-outline-gradient` (+ `.btn-lg` en la ficha), `.btn-ghost`, `.badge .badge-deal` (+ `.badge-lg`), `.tap-link` (zona táctil de 44 px en enlaces de texto, solo en pantallas táctiles), `.search-field`.
- Bordes de buscadores con `outline` (no ocupa espacio) para que midan 44 px por dentro y por fuera.
- `html, body { overflow-x: clip }`: con `hidden` dejan de funcionar las cabeceras `sticky`.

**Comprobaciones antes de desplegar**: `npx tsc --noEmit`, `npx eslint src` y auditoría en móvil (390 px) de todas las rutas: 0 errores JS, 0 scroll horizontal, un `h1` por página, 0 zonas táctiles <44 px.
