# Estudio: WhatsApp para Chollos de Hoy / CazaOfertas

Fecha: 2026-09-27. Estado: **no hay tareas ni código de WhatsApp** en el repo (la única mención es el user-agent del rastreador de vistas previas en `src/app/api/redirect/route.ts`, para no contarlo como clic).

## Qué tenemos hoy en Telegram (lo que habría que replicar)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Bot con asistente de alertas | `src/services/telegram/bot.ts`, `alertWizard.ts`, `src/app/api/telegram` | El usuario crea alertas (categoría, marca, URL, descuento mínimo) con botones |
| Alertas personales | `src/services/notifications.ts` + `alertMatching.ts` | Cruza ofertas con alertas y envía un mensaje por usuario (con deduplicado y variantes) |
| Canal / grupo público | `src/services/telegram.ts`, `telegramFlush.ts`, tabla `channel_notifications` | Publica chollos en lotes con enfriamiento |
| Enlaces desde la web | `src/lib/telegram-links.ts`, `TelegramCta` | «Crear alerta» y «Grupo de Telegram» |

`alertMatching.ts` no depende de Telegram: se puede reutilizar tal cual. Lo específico de Telegram es el envío, el webhook y la identidad del usuario (`users.telegram_id`).

## Tres cosas distintas que se pueden hacer en WhatsApp

### A. Canal de WhatsApp (difusión, como el grupo de Telegram)

- **La API oficial de Meta no permite publicar en Canales.** Solo se puede publicar a mano desde la app.
- Hay servicios de terceros (Whapi.Cloud, WAHA, Maytapi, WASenderApi) que lo automatizan, pero emulan WhatsApp Web con un número normal: **va contra las condiciones de WhatsApp y el número puede ser bloqueado**, perdiendo el canal y sus seguidores.
- Coste: gratis a mano; los terceros cobran una cuota mensual.
- **Viable sin riesgo solo a mano**: p. ej. un «Top 5 del día» publicado una vez al día (se puede generar el texto desde el admin para copiar y pegar).

### B. Alertas personales por WhatsApp (como las del bot de Telegram)

Requiere la **WhatsApp Business Platform (Cloud API) oficial**:

- Cuenta de Meta Business **verificada**, un número de teléfono dedicado (no puede estar en la app de WhatsApp) y **plantillas aprobadas** por Meta para cada tipo de mensaje que inicie el negocio.
- **Consentimiento explícito** (opt-in) del usuario para recibir mensajes.
- **Se paga por mensaje entregado** (modelo por mensaje desde julio de 2025). Tarifas de Meta para España en 2026:
  - Marketing: **~0,051 €** por mensaje.
  - Utilidad: ~0,017 € (gratis dentro de la ventana de 24 h tras un mensaje del usuario).
  - Respuestas dentro de la ventana de 24 h: **gratis**.
  - Más la cuota del proveedor (BSP), si no se usa la Cloud API directamente.
- Un aviso de «este producto ha bajado de precio» promociona un producto: lo normal es que Meta lo clasifique como **marketing**, aunque lo haya pedido el usuario.
- Ejemplo: 100 usuarios × 3 alertas/día × 30 días = 9.000 mensajes ≈ **460 €/mes** solo en tarifas de Meta. Con los ingresos por afiliado actuales es difícil que compense. En Telegram es gratis.
- **Riesgo propio**: la cuenta de Meta ya tiene un bloqueo 368 en Facebook (ver `TAREAS.md`). La verificación del Business Manager y la calidad del número dependen de la misma cuenta; convendría resolver eso antes.

### C. Bot de consulta («busco auriculares» → te devuelvo los 5 mejores chollos)

- El usuario escribe primero, así que todas las respuestas caen dentro de la **ventana de servicio de 24 h: gratis** y sin plantillas.
- Misma Cloud API oficial (cuenta verificada + número dedicado), pero sin coste por mensaje.
- Encaja con lo que ya hay: búsqueda del catálogo (`src/lib/catalog.ts` / `/api/ofertas`) y enlaces de afiliado con seguimiento (`/api/redirect`).
- Mensajes interactivos: listas y botones (hasta 3 botones o una lista de 10 filas), útiles para «Ver más» o elegir categoría.

## Cómo se montaría (B y C, con la API oficial)

1. **Meta**: crear la app de WhatsApp en Meta for Developers, verificar el negocio, dar de alta el número y obtener un token de sistema permanente.
2. **Webhook** `POST /api/whatsapp` (y `GET` para la verificación con `hub.verify_token`), validando la firma `X-Hub-Signature-256` con el app secret, igual que el webhook de Telegram valida su secreto.
3. **Datos**: columna `users.whatsapp_phone` (E.164) con fecha de opt-in, y `channel` en `notifications` para saber por dónde salió cada aviso.
4. **Servicio de envío** `src/services/whatsapp/`: texto, interactivos y plantillas (`POST /{phone-number-id}/messages`).
5. **Alertas (solo B)**: en `notifications.ts`, enviar por Telegram o por WhatsApp según el canal del usuario. `alertMatching.ts` no cambia. Añadir tope diario por usuario para controlar el coste.
6. **Web**: botón «Recibir por WhatsApp» junto a «Crear alerta» (enlace `https://wa.me/<número>?text=...` que abre el chat con un texto ya escrito; ese primer mensaje abre la ventana gratis de 24 h).

Esfuerzo aproximado: C (bot de consulta) 2–3 días; B (alertas) 3–5 días más, sin contar la verificación de Meta y la aprobación de plantillas.

## Recomendación

1. **Ahora**: un **Canal de WhatsApp a mano** con un resumen diario (coste 0, sin riesgo) para medir si hay demanda.
2. **Si hay demanda**: el **bot de consulta (C)** con la API oficial. Es gratis por mensaje y reutiliza el catálogo.
3. **Alertas personales (B)** solo si los números lo justifican (≈0,05 € por aviso), con tope por usuario, y después de resolver el bloqueo de Meta.
4. **No** usar librerías o servicios no oficiales (Baileys, whatsapp-web.js, Whapi, WAHA…) para automatizar: riesgo de bloqueo del número.

## Fuentes

- [Precios de la WhatsApp Business Platform — Meta for Developers](https://developers.facebook.com/docs/whatsapp/pricing)
- [Precios de la API de WhatsApp en España 2026 — Blueticks](https://blueticks.co/blog/whatsapp-business-pricing-europe-2026)
- [Precios de la API de WhatsApp en España 2026 — Whautomate](https://whautomate.com/whatsapp-business-api-pricing-spain)
- [Automatización de Canales de WhatsApp (terceros) — Whapi.Cloud](https://whapi.cloud/blog/whatsapp-channel-api-automation)
- [Canales de WhatsApp — WAHA](https://waha.devlike.pro/whatsapp-channels/)
