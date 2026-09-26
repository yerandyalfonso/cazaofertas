# Crons: reparto VPS / Mac

**El doble trabajo es intencionado.** El Mac (IP residencial) repite varios
jobs del VPS para encontrar más productos: a la IP del VPS (nube) la bloquean
antes Amazon, Miravia y compañía. No quitar los LaunchAgents del Mac por
«duplicados».

Los dos ejecutan el mismo `scripts/local-cron/run.ts <job>`. VPS: timers
systemd `cazaofertas-cron-<job>.timer` → `cazaofertas-cron@.service`.
Mac: LaunchAgents `com.cazaofertas.cron.<job>` → `run.sh`.

| Job | VPS | Mac | Notas |
|-----|-----|-----|-------|
| `flash-deals` | cada 3 min | cada 10 min | VPS sin Miravia (`CAZAOFERTAS_FLASH_INCLUDE_MIRAVIA=0`) |
| `check-prices` | cada 10 min | cada 10 min | VPS: `RETAIL_PRICE_CHECK_SKIP_RETAILERS=miravia` y `CAZAOFERTAS_META_FLUSH=1` (solo el VPS publica en Facebook/Instagram) |
| `user-alerts` | cada hora | 08:15, 20:15 | Todas las tiendas menos PcComponentes |
| `kiabi-deals` | 09:30, 18:30 | 09:30, 18:30 | |
| `coupons-discover` | 10:00, 18:00 | 10:00, 18:00 | |
| `miravia-deals` | timer desactivado | cada 30 min | Miravia da captcha a la IP del VPS |
| `amazon-price-check` | — | cada 5 min | Solo Amazon; respeta la pausa anti-bot |
| `user-alerts-residential` | — | cada 30 min | Solo PcComponentes |
| `admin-digest` | 09:00, 15:00, 21:00 | — | |
| backup | 03:00 | 04:00 (`pullbackup`, copia al Mac) | |

`com.cazaofertas.vps-tunnel` (Mac) mantiene un túnel SSH al VPS; si el Mac
pierde la red sale con código 255 y launchd lo relanza.

---

## Perfiles de cron local (macOS LaunchAgents)

Dos perfiles guardados para poder cambiar sin reinventar horarios.

### Perfil por defecto — bajo egress (`install-macos.sh`)

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

### Perfil alta frecuencia — legacy (`install-macos.high-frequency.sh`)

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

#### Qué NO se revierte

Las consultas estrechas a Supabase (sin descargar el catálogo entero) se mantienen en ambos perfiles. Solo cambian **intervalos** y si Miravia va acoplado al flash.

### Cambio rápido

```bash
# Bajo egress (recomendado)
npm run cron:local:install

# Alta frecuencia (legacy)
npm run cron:local:install:high-freq

# Quitar todos los agents
npm run cron:local:uninstall
```
