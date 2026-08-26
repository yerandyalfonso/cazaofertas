puedes ayudarme a monbtar todo esto ?
Sí. Te prepararía un prompt pensado para usarlo con Cursor, Claude Code, Codex o un agente de programación, para que genere el proyecto completo pero sin acoplarlo inicialmente a Keepa, dejando el proveedor de precios como una capa intercambiable.
La idea sería construir un MVP real con Next.js + Vercel + Supabase + Telegram Bot + Amazon Afiliados, preparado para añadir Amazon Creators API/Keepa cuando tengamos acceso.

Crear plataforma automatizada de ofertas de Amazon España
Quiero construir una plataforma web de ofertas de Amazon España, orientada a SEO, monetización mediante Amazon Afiliados y alertas personalizadas mediante Telegram.
El sistema debe ser escalable, modular y preparado para funcionar inicialmente con un volumen de aproximadamente 1.000 productos, comprobando precios una vez al día.

1. Stack tecnológico
Utiliza:

Next.js con App Router
TypeScript
Tailwind CSS
SupabasePostgreSQL
Auth
Database
Vercel para deployment
Telegram Bot API
Cron Jobs / Vercel Cron o un worker externo para tareas programadas
Zod para validación
API routes / Server Actions cuando sea apropiado
No utilices un CMS externo. Supabase será la fuente de datos y funcionará como CMS interno.
La arquitectura debe permitir sustituir fácilmente el proveedor de precios.

2. Arquitectura
Crear una arquitectura modular:

Amazon / Price Provider
        ↓
Price Provider Adapter
        ↓
Price Detection Service
        ↓
Supabase
        ↓
 ┌───────────────┬────────────────┐
 ↓               ↓                ↓
Web           Telegram          Admin
Next.js       Bot               Dashboard
 ↓               ↓
Amazon        User Alerts
Affiliate
El proveedor de precios NO debe estar directamente mezclado con la lógica de negocio.
Crear una interfaz similar a:

interface PriceProvider {
  getProduct(asin: string): Promise<ProductPriceData>;
  getProducts(asins: string[]): Promise<ProductPriceData[]>;
}
Crear inicialmente un MockPriceProvider para poder desarrollar y probar todo el sistema sin depender de Amazon, Keepa o ninguna API externa.
Preparar posteriormente adapters independientes para:

Amazon Creators API
Keepa
Otros proveedores
No implementar scraping de Amazon.

3. Base de datos Supabase
Crear migraciones SQL para las siguientes tablas.

products
Campos:

id
asin
title
slug
description
image_url
amazon_url
affiliate_url
brand
category_id
current_price
previous_price
lowest_price
highest_price
discount_percentage
currency
availability
last_checked_at
created_at
updated_at
is_active
is_featured
El ASIN debe ser único.

categories
Campos:

id
name
slug
description
image_url
is_active
created_at
Crear inicialmente:

Hogar
Belleza
Tecnología
Deportes
Moda
Juguetes
Informática
price_history
Campos:

id
product_id
price
timestamp
source
Crear índices apropiados para consultar rápidamente el histórico de un producto.

users
Campos:

id
telegram_id
telegram_username
email
created_at
last_active_at
alerts
Cada usuario puede tener múltiples alertas.
Campos:

id
user_id
category_id nullable
product_id nullable
brand nullable
min_discount_percentage nullable
max_price nullable
min_price nullable
active
created_at
updated_at
Una alerta puede estar asociada a:

un producto específico
una categoría
una marca
o una combinación de filtros
notifications
Campos:

id
user_id
product_id
alert_id
old_price
new_price
discount_percentage
sent_at
status
Utilizar esta tabla para evitar enviar repetidamente la misma alerta.

4. Detección de ofertas
Crear un servicio:
priceDetectionService
Flujo:

Obtener productos activos.
Consultar el proveedor de precios.
Comparar precio actual con precio almacenado.
Guardar el precio anterior.
Actualizar precio actual.
Guardar registro en price_history.
Calcular porcentaje de descuento.
Actualizar lowest_price.
Determinar si existe una oferta.
Buscar usuarios con alertas compatibles.
Crear notificaciones.
Enviar las notificaciones mediante Telegram.
La fórmula de descuento debe ser:

discount = ((previousPrice - currentPrice) / previousPrice) * 100
Pero también permitir posteriormente comparar contra:

precio medio histórico
precio mínimo histórico
precio de 7 días
precio de 30 días
precio de 90 días
5. Reglas para detectar una buena oferta
No considerar automáticamente cualquier bajada como una oferta.
Crear un servicio:
dealScoringService
Debe calcular un score utilizando:

porcentaje de descuento
diferencia absoluta de precio
distancia respecto al mínimo histórico
frecuencia de cambios
antigüedad del precio
categoría
Ejemplo:

30% descuento
+ cerca del mínimo histórico
+ producto estable
= HIGH DEAL
Crear niveles:

NORMAL
GOOD_DEAL
GREAT_DEAL
HISTORICAL_LOW
El sistema debe ser configurable.

6. Amazon Afiliados
Todos los enlaces externos a Amazon deben pasar por una función central:

generateAffiliateUrl(product)
Nunca colocar directamente URLs de Amazon por todo el código.
Utilizar variables de entorno para:

AMAZON_ASSOCIATE_TAG
AMAZON_MARKETPLACE
La arquitectura debe estar preparada para integrar Amazon Creators API cuando tengamos acceso.
No inventar datos de la API.
Crear:
AmazonCreatorsApiProvider
como adapter preparado para futuras credenciales.
Mientras no existan credenciales, utilizar:
MockPriceProvider

7. Telegram Bot
Crear un bot mediante Telegram Bot API.
Variables:

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
El bot debe permitir:

/start
/help
/alerts
/addalert
/removealert
/products
/categories
/settings
También debe utilizar botones inline de Telegram para que el usuario no tenga que escribir comandos.

/start
Mostrar:

🔥 Amazon Deals

Encuentra las mejores ofertas de Amazon España.

Puedes crear alertas personalizadas y recibir únicamente los productos que te interesan.

[🔔 Crear alerta]
[📂 Categorías]
[🔥 Mejores ofertas]
[⚙️ Mis alertas]
8. Sistema de alertas de Telegram
Permitir configurar:

Producto específico
Ejemplo:

AirPods Pro
Avisar cuando baje más de 10%
Categoría
Ejemplo:

Tecnología
Descuento mínimo: 20%
Precio máximo: 500 €
Marca
Ejemplo:

Nike
Descuento mínimo: 25%
Filtros combinados
Ejemplo:

Categoría: Hogar
Precio máximo: 200 €
Descuento mínimo: 25%
El usuario solamente debe recibir ofertas que coincidan con sus filtros.

9. Formato de alerta
Crear mensajes como:

🔥 GRAN OFERTA

Apple AirPods Pro

💰 179,99 €
~~249,99 €~~

📉 -28%

⭐ Precio cercano al mínimo histórico

🏠 Tecnología

[🛒 VER EN AMAZON]
El botón debe utilizar el enlace de afiliado.
No enviar una alerta repetida si el producto sigue exactamente al mismo precio.

10. Web pública
Crear una web moderna, rápida y responsive.
Estética:

moderna
limpia
tecnológica
orientada a ofertas
mobile-first
buena jerarquía visual
tarjetas de productos
badges de descuento
CTA claros
Marca provisional:
CazaOferta
No asumir que este será el nombre definitivo.

Home
Secciones:

Hero
Ofertas destacadas
Mejores ofertas del día
Categorías
Últimas bajadas
Ofertas cerca del mínimo histórico
CTA para recibir alertas en Telegram
Ejemplo:

CazaOferta

Las mejores ofertas de Amazon,
actualizadas automáticamente.

[🔥 Ver ofertas]
[🔔 Alertas Telegram]
11. Página de ofertas
Ruta:
/ofertas
Filtros:

categoría
descuento
precio
marca
orden
mínimo histórico
Ordenaciones:

mayor descuento
mayor ahorro
precio más bajo
más recientes
mejor oferta
12. Categorías
Crear:

/categoria/hogar
/categoria/belleza
/categoria/tecnologia
/categoria/deportes
/categoria/moda
/categoria/juguetes
/categoria/informatica
Cada categoría debe tener:

SEO title
meta description
H1
descripción
productos
filtros
13. Página de producto
Ruta:
/producto/[slug]
Mostrar:

imagen
título
precio actual
precio anterior
porcentaje de descuento
ahorro
disponibilidad
categoría
marca
histórico de precio
fecha de última actualización
CTA “Ver en Amazon”
botón “Crear alerta”
Mostrar un gráfico de histórico de precios.

14. SEO
Implementar correctamente:

metadata dinámica
canonical URLs
Open Graph
Twitter/X cards
sitemap.xml
robots.txt
structured data
Product schema cuando sea apropiado
Breadcrumb schema
Article schema cuando corresponda
Generar URLs limpias.
No crear páginas duplicadas.
Implementar páginas útiles para SEO, no generar miles de páginas vacías.

15. Performance
Optimizar para:

Core Web Vitals
imágenes optimizadas
lazy loading
server-side rendering cuando sea apropiado
caching
ISR/revalidation
El frontend debe funcionar muy bien en móviles.

16. Admin Dashboard
Crear:
/admin
Proteger mediante autenticación.
Secciones:

Dashboard
Mostrar:

productos activos
ofertas detectadas hoy
usuarios Telegram
alertas activas
notificaciones enviadas
clicks a Amazon
productos con mayor descuento
Productos
Permitir:

crear
editar
eliminar
activar/desactivar
cambiar categoría
cambiar producto destacado
Categorías
CRUD completo.

Usuarios
Mostrar:

Telegram username
alertas activas
última actividad
Alertas
Ver filtros creados.

17. Analytics
Preparar tracking para:

clicks hacia Amazon
productos más visitados
productos más clicados
categorías más populares
conversiones si los datos de Amazon Associates permiten obtenerlas
Crear una tabla:
affiliate_clicks
Campos:

id
product_id
user_id nullable
source
created_at
No almacenar datos personales innecesarios.

18. Cron
Crear una tarea diaria:

GET /api/cron/check-prices
Proteger mediante:

CRON_SECRET=
El endpoint debe:

validar secret
obtener productos activos
procesar productos en batches
consultar PriceProvider
actualizar precios
guardar histórico
detectar ofertas
generar notificaciones
enviar Telegram
devolver estadísticas
No procesar los 1.000 productos simultáneamente.
Utilizar batches.

19. Seguridad
Implementar:

validación con Zod
protección de endpoints
secrets solamente en server
RLS en Supabase
autenticación para admin
rate limiting donde sea necesario
validación del webhook de Telegram
no exponer API keys en frontend
20. Variables de entorno
Crear .env.example:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

AMAZON_ASSOCIATE_TAG=
AMAZON_MARKETPLACE=ES

AMAZON_API_ACCESS_KEY=
AMAZON_API_SECRET=

CRON_SECRET=
Nunca incluir valores reales.

21. Desarrollo sin APIs externas
El proyecto debe funcionar completamente utilizando MockPriceProvider.
Crear datos ficticios:

20 productos
varias categorías
diferentes precios
histórico
usuarios
alertas
Crear una función que simule cambios de precio para probar las alertas.
Debe ser posible probar todo el sistema localmente sin Amazon.

22. Tests
Crear tests para:

cálculo de descuento
detección de oferta
comparación histórica
filtros de usuarios
matching de alertas
generación de affiliate URL
prevención de notificaciones duplicadas
price provider
Telegram notification service
Crear también tests de integración para:

price change
→ deal detected
→ matching alert
→ notification created
→ Telegram notification
23. Documentación
Crear:
README.md
Debe explicar:

arquitectura
instalación
configuración de Supabase
migraciones
configuración de Telegram
configuración de Vercel
configuración de Cron
configuración del proveedor de precios
configuración futura de Amazon Creators API
variables de entorno
cómo ejecutar tests
cómo ejecutar localmente
24. Principio fundamental
No construir un sistema dependiente de un proveedor concreto.
Debe ser posible cambiar:

Keepa
por:

Amazon Creators API
o:

Otro Price Provider
sin modificar el resto de la aplicación.
La interfaz del proveedor debe abstraer completamente:

autenticación
requests
parsing
errores
rate limits
25. Orden de implementación
Implementar en este orden:

Fase 1
Next.js
TypeScript
Tailwind
Supabase
Database schema
seed data
Fase 2
Product model
Categories
Price history
MockPriceProvider
Price detection
Fase 3
Deal scoring
Alert matching
Notifications
Fase 4
Telegram bot
Telegram webhook
Telegram inline keyboards
User alerts
Fase 5
Public website
Home
Categories
Offers
Product pages
Fase 6
Admin dashboard
Fase 7
Cron
Vercel deployment
Monitoring
Fase 8
Amazon Creators API adapter
Affiliate URL generation
Real price provider
26. Reglas de implementación
TypeScript estricto.
Código modular.
Componentes reutilizables.
No duplicar lógica.
Server-side secrets.
No hardcodear tokens.
No hacer scraping de Amazon.
No inventar APIs.
No crear dependencias innecesarias.
Utilizar buenas prácticas de Next.js App Router.
Crear commits lógicos si se trabaja con Git.
Documentar decisiones importantes.
Antes de escribir código, analiza la arquitectura y crea primero la estructura del proyecto, schema de base de datos y interfaces principales.
Después implementa cada fase de manera incremental.
Al finalizar cada fase, ejecuta los tests y verifica que el proyecto compile correctamente.
El objetivo es entregar una aplicación funcional que pueda ejecutarse localmente y desplegarse posteriormente en Vercel.