This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Desarrollo local (dos plataformas)

Monorepo con **CazaOfertas** (blog) y **Chollos de Hoy** (marketplace), cada uno en su puerto:

| App | Puerto | Comando |
|-----|--------|---------|
| CazaOfertas | **3000** | `npm run dev` o `npm run dev:caza` |
| Chollos de Hoy | **3001** | `npm run dev:chollos` |
| **Ambas a la vez** | 3000 + 3001 | `npm run dev:all` |

La primera vez (o tras cambiar Supabase en la raíz):

```bash
npm run setup:chollos-env   # copia credenciales a apps/chollosdehoy/.env.local
```

- Blog: [http://localhost:3000](http://localhost:3000)
- Marketplace: [http://localhost:3001](http://localhost:3001)

Código compartido en `packages/shared` (`@cazaofertas/shared`): taxonomía, utilidades de precio, etc.

## Getting Started (solo blog)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Flujo VPS (producción real desde 2026-09-21)

El sistema real ya **no corre en Vercel/Supabase Cloud** — corre en un VPS propio
(self-hosted Supabase + `systemd` + Caddy). Vercel/Supabase Cloud quedan inactivos
como rollback, sin borrar, pero no hay que desplegar ahí.

```bash
# Publicar código (después de git push a main):
./deploy.sh          # ambas apps
./deploy.sh caza     # solo CazaOfertas (admin + blog, hoy en admin.chollosdhoy.com)
./deploy.sh chollos  # solo Chollos de Hoy (marketplace, en chollosdhoy.com)

# Aplicar un cambio de esquema de la base de datos:
./apply-migration.sh supabase/migrations/00XX_nombre.sql
```

Requisitos: alias SSH `vps` configurado en `~/.ssh/config` de tu máquina, apuntando
al VPS con la llave de deploy.

`scripts/deploy-chollos.sh` (Vercel) quedó obsoleto — usa `./deploy.sh chollos`.
