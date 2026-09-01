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

## Deploy en Vercel

Proyecto: **chollosdehoy** (monorepo, root `apps/chollosdehoy`).

- Producción: https://chollosdehoy.vercel.app
- Dominio objetivo: `chollosdehoy.com` → añadir en Vercel → Project → Domains

Desde la **raíz del repo**:

```bash
vercel deploy --prod
```

Variables de entorno ya configuradas en Vercel (Supabase + `NEXT_PUBLIC_SITE_URL`).

## Funcionalidades

- **Paginación** server-side (24 ofertas/página) vía `GET /api/ofertas`
- **Hero por categorías** con imágenes de la taxonomía compartida
- **Cupones** en página dedicada `/cupones` (por tienda, vigencia)
- Script esqueleto: `npm run coupons:discover` (detección automática Fase 2)
- Filtros, grid/lista, sidebar de top chollos
