import { BLOG_IMAGES } from "@/lib/blog-images";

/**
 * 8 piezas editoriales adicionales (HTML) para seed:blog.
 * relatedProductSlugs enlaza con products existentes vía article_products.
 */
export const EXTRA_HTML_BLOG_POSTS = [
  {
    slug: "guia-ssd-nvme-upgrade-portatil",
    title: "Cómo elegir un SSD NVMe para actualizar tu portátil sin equivocarte",
    excerpt:
      "Capacidad, PCIe 4.0 y precio real: la checklist corta antes de comprar almacenamiento en oferta.",
    category: "Tecnología",
    readingTime: "7 min",
    publishedAt: "2026-08-21",
    featured: true,
    coverImage: BLOG_IMAGES.ssdTech,
    coverAlt: "Unidad SSD NVMe sobre mesa",
    body: [],
    relatedProductSlugs: ["ssd-nvme-1tb-pcie4", "monitor-27-qhd-165hz"],
    html: `
<p>Actualizar el almacenamiento es uno de los upgrades con mejor relación coste/beneficio. En Amazon España los SSD NVMe bajan con frecuencia, pero conviene mirar más allá del cartel de descuento.</p>
<blockquote>Capacidad, interfaz y precio cerca del mínimo: esa es la tríada útil.</blockquote>
<hr />
<h2>Qué mirar antes de comprar</h2>
<p>Prioriza interfaz (PCIe 4.0 si tu placa lo permite), capacidad real usable y garantía del fabricante. Un 1 TB suele ser el punto dulce para sistemas con muchos proyectos o bibliotecas de medios.</p>
<h2>Señales de un chollo de verdad</h2>
<p>Compara el precio actual con el mínimo reciente y evita picos artificiales. Si la bajada se sostiene unos días y se acerca al histórico, tiene más sentido actuar.</p>
<h2>Complemento de escritorio</h2>
<p>Si además trabajas con vídeo o diseño, un monitor QHD 165 Hz puede ser el siguiente movimiento cuando el score de oferta sea alto.</p>
<p>Activa una alerta por “SSD” o la marca en Telegram para no perseguir el precio a ciegas.</p>
`.trim(),
  },
  {
    slug: "altavoces-inteligentes-sin-ruido",
    title: "Altavoces inteligentes: cuándo merece la pena el modelo compacto",
    excerpt:
      "Asistente de voz, sonido 360º y precio estable. Cómo filtrar ofertas de altavoces sin caer en el marketing.",
    category: "Tecnología",
    readingTime: "5 min",
    publishedAt: "2026-08-19",
    coverImage: BLOG_IMAGES.speaker,
    coverAlt: "Altavoz inteligente compacto",
    body: [],
    relatedProductSlugs: ["altavoz-inteligente-compacto", "auriculares-anc-wireless"],
    html: `
<p>Los altavoces con asistente se han convertido en un accesorio de entrada al hogar conectado. El problema: muchas “ofertas” solo reflejan el precio habitual de catálogo.</p>
<h2>Uso real frente a ficha técnica</h2>
<p>Para cocina o despacho, un formato compacto suele bastar. Valora cobertura Wi‑Fi, calidad de micrófono y si necesitas multiroom más adelante.</p>
<h2>Cómo combinarlo con audio personal</h2>
<p>Si ya tienes auriculares ANC, el altavoz cubre el uso compartido en casa y los auriculares el foco o el transporte. No hace falta duplicar presupuesto en dos gamas altas el mismo mes.</p>
<h2>Checklist express</h2>
<p>Precio cerca del mínimo, devolución clara en Amazon y alerta de Telegram con la keyword del modelo. Así cazas la ventana buena sin revisar la página cada día.</p>
`.trim(),
  },
  {
    slug: "freidora-aire-guia-compra-hogar",
    title: "Freidora de aire: guía práctica para acertar con litros y programas",
    excerpt:
      "Capacidad, programas y consumo. Todo lo que importa cuando una freidora de 5,5 L baja de precio.",
    category: "Hogar",
    readingTime: "6 min",
    publishedAt: "2026-08-17",
    featured: true,
    coverImage: BLOG_IMAGES.cooking,
    coverAlt: "Freidora de aire en cocina",
    body: [],
    relatedProductSlugs: ["freidora-aire-5-5l"],
    html: `
<p>La freidora de aire se ha instalado en muchas cocinas españolas. El tamaño importa: una cubeta de 5,5 L cubre bien a 3–4 personas sin ocupar media encimera.</p>
<h2>Litros, cestas y limpieza</h2>
<p>Revisa si el cestillo es antiadherente y lavable. Los programas predefinidos ahorran tiempo, pero un control de temperatura manual sigue siendo útil para recetas propias.</p>
<h2>Cuándo comprar</h2>
<p>Espera a una bajada verificada respecto al precio reciente. Si el descuento se acerca al mínimo histórico, tiene más sentido que un −20 % de escaparate.</p>
<h2>Consejo de uso el primer mes</h2>
<p>Empieza con raciones pequeñas para calibrar tiempos. Aceite en spray mínimo y no sobrecargues la cesta: el aire necesita circular.</p>
`.trim(),
  },
  {
    slug: "pequenos-electrodomesticos-chollos-cocina",
    title: "Pequeños electrodomésticos: tres reglas para no llenar la cocina de ruido",
    excerpt:
      "Menos impulsos, más score. Cómo priorizar freidoras y gadgets de cocina cuando Amazon tira precios.",
    category: "Hogar",
    readingTime: "5 min",
    publishedAt: "2026-08-15",
    coverImage: BLOG_IMAGES.kitchen,
    coverAlt: "Cocina luminosa con utensilios",
    body: [],
    relatedProductSlugs: ["freidora-aire-5-5l", "altavoz-inteligente-compacto"],
    html: `
<p>El hogar es una categoría con mucho volumen… y mucho ruido. Antes de añadir otro aparato, aplica tres filtros simples.</p>
<h2>1. ¿Lo usarás cada semana?</h2>
<p>Si la respuesta es dudosa, espera. Un chollo de algo que acumula polvo no es un ahorro.</p>
<h2>2. ¿El descuento es real?</h2>
<p>Compara con el precio reciente y el mínimo. Las freidoras y altavoces de cocina suelen tener curvas más legibles que otros gadgets de temporada.</p>
<h2>3. ¿Cabe en tu rutina?</h2>
<p>Espacio, limpieza y ruido importan tanto como los vatios. Cuando el score de oferta es alto y el uso está claro, entonces sí: compra con enlace de afiliado y listo.</p>
`.trim(),
  },
  {
    slug: "zapatillas-running-asfalto-guia",
    title: "Zapatillas de running para asfalto: amortiguación, drop y precio útil",
    excerpt:
      "Cómo leer una ficha de running y detectar cuándo la bajada en Amazon merece la pena.",
    category: "Deportes",
    readingTime: "7 min",
    publishedAt: "2026-08-14",
    coverImage: BLOG_IMAGES.running,
    coverAlt: "Zapatillas running sobre asfalto",
    body: [],
    relatedProductSlugs: ["zapatillas-running-asfalto", "reloj-deportivo-gps"],
    html: `
<p>En running de asfalto, la zapatilla correcta reduce molestias y alarga la vida útil de tus rodillas. El precio importa, pero después de encajar uso y horma.</p>
<h2>Amortiguación y drop</h2>
<p>Si entrenas volumen medio, busca una entresuela reactiva y un drop cómodo para ti. Prueba talla con margen de un dedo; muchas devoluciones nacen de comprar justo.</p>
<h2>Cuándo el descuento es interesante</h2>
<p>Las marcas premium oscilan. Una bajada sostenida cerca del mínimo histórico suele ser mejor señal que un flash de 24 horas.</p>
<h2>Par de entrenamiento completo</h2>
<p>Un reloj con GPS ayuda a medir ritmos sin móvil. Si ambos productos bajan en la misma ventana, prioriza primero el calzado: es el contacto con el suelo.</p>
`.trim(),
  },
  {
    slug: "reloj-gps-y-esterilla-rutina",
    title: "Rutina híbrida: reloj GPS + esterilla para entrenar en casa y fuera",
    excerpt:
      "Mide afuera, recupera adentro. Una combinación deportiva con buen retorno cuando hay oferta.",
    category: "Deportes",
    readingTime: "6 min",
    publishedAt: "2026-08-13",
    coverImage: BLOG_IMAGES.watch,
    coverAlt: "Reloj deportivo con GPS",
    body: [],
    relatedProductSlugs: [
      "reloj-deportivo-gps",
      "esterilla-yoga-antideslizante",
    ],
    html: `
<p>No hace falta un gimnasio completo para mantener constancia. Un reloj con GPS y una esterilla antideslizante cubren rodaje exterior y movilidad en casa.</p>
<h2>Qué aporta el GPS</h2>
<p>Ritmo, distancia y pulsaciones sin depender del teléfono. Busca modos deportivos que uses de verdad; el resto es ruido de ficha.</p>
<h2>La esterilla no es un accesorio menor</h2>
<p>Un buen agarre y 6 mm de espesor cambian la calidad de yoga, core o estiramientos. Es de los productos donde un descuento limpio sí se nota en el día a día.</p>
<h2>Estrategia de compra</h2>
<p>Si solo puedes pillar uno en oferta esta semana, prioriza el que más uses. Configura alertas distintas en Telegram para no mezclar señales.</p>
`.trim(),
  },
  {
    slug: "secador-ionico-belleza-compra",
    title: "Secador iónico profesional: potencia, peso y cuándo comprar",
    excerpt:
      "2000 W no lo es todo. Guía breve para elegir secador con iones cuando el precio cae de verdad.",
    category: "Belleza",
    readingTime: "5 min",
    publishedAt: "2026-08-11",
    coverImage: BLOG_IMAGES.beauty,
    coverAlt: "Secador de pelo profesional",
    body: [],
    relatedProductSlugs: ["secador-ionico-profesional"],
    html: `
<p>En belleza, el marketing de “profesional” aparece en casi todas las fichas. Lo útil es separar potencia, motor y ergonomía del reclamo de descuento.</p>
<h2>Iones y daño por calor</h2>
<p>La tecnología iónica ayuda a reducir encrespamiento. Combínala con temperaturas regulables: más potencia no siempre significa mejor resultado.</p>
<h2>Peso y uso diario</h2>
<p>Si te secas el pelo a diario, el peso del aparato importa tanto como los vatios. Un mango equilibrado evita fatiga de muñeca.</p>
<h2>Señal de compra</h2>
<p>Cuando el precio se acerca al mínimo y el descuento supera el ruido habitual de la categoría, es buen momento. Activa una alerta por marca o “secador iónico”.</p>
`.trim(),
  },
  {
    slug: "moda-zapatillas-oferta-sin-impulse",
    title: "Moda en oferta: cómo comprar zapatillas sin caer en el impulso",
    excerpt:
      "Temporada, talla y score. Un método corto para moda deportiva en Amazon España.",
    category: "Modas",
    readingTime: "4 min",
    publishedAt: "2026-08-10",
    coverImage: BLOG_IMAGES.sneakers,
    coverAlt: "Estantería de zapatillas",
    body: [],
    relatedProductSlugs: ["zapatillas-running-asfalto"],
    html: `
<p>La moda mueve stock rápido y precios volátiles. Por eso es fácil confundir un cambio de temporada con un chollo.</p>
<h2>Separar deseo y necesidad</h2>
<p>Si no tienes un uso claro (running, diario, viaje), aparca el carrito 24 horas. La mayoría de impulsos no sobreviven a esa pausa.</p>
<h2>Talla y devolución</h2>
<p>Consulta la guía del vendedor y prioriza sellers con devolución sencilla. Una oferta excelente en talla incorrecta deja de serlo.</p>
<h2>Usa el score, no solo el % </h2>
<p>El porcentaje del cartel miente a menudo. Confía más en la proximidad al mínimo histórico y en alertas por modelo o marca.</p>
`.trim(),
  },
];
