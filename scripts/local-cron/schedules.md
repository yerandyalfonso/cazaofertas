# Perfiles de cron local (macOS LaunchAgents)

Dos perfiles guardados para poder cambiar sin reinventar horarios.

## Perfil por defecto — bajo egress (`install-macos.sh`)

Pensado para no saturar el egress de Supabase Free.

| Job | Cadencia | Notas |
|-----|----------|--------|
| `flash-deals` | cada **10 min** (`StartInterval` 600) | Solo Amazon |
| `miravia-deals` | cada **30 min** (`StartInterval` 1800) | Job aparte |
| `check-prices` | cada 10 min | Precios + flush Telegram si toca |
| `user-alerts` | 08:15, 20:15 | |
| `kiabi-deals` | 09:30, 18:30 | |
| `coupons-discover` | 10:00, 18:00 | |

```bash
npm run cron:local:install
```

## Perfil alta frecuencia — legacy (`install-macos.high-frequency.sh`)

Config anterior (pre-optimización egress, ~ago–sep 2026):

| Job | Cadencia | Notas |
|-----|----------|--------|
| `flash-deals` | cada **3 min** (`StartInterval` 180) | Incluye Miravia (`CAZAOFERTAS_FLASH_INCLUDE_MIRAVIA=1`) |
| `miravia-deals` | **no** se instala | Va dentro de flash |
| `check-prices` | cada 10 min | Igual |
| resto | igual | |

```bash
npm run cron:local:install:high-freq
```

### Qué NO se revierte

Las consultas estrechas a Supabase (sin descargar el catálogo entero) se mantienen en ambos perfiles. Solo cambian **intervalos** y si Miravia va acoplado al flash.

## Cambio rápido

```bash
# Bajo egress (recomendado)
npm run cron:local:install

# Alta frecuencia (legacy)
npm run cron:local:install:high-freq

# Quitar todos los agents
npm run cron:local:uninstall
```
