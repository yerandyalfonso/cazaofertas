#!/usr/bin/env node
/**
 * Generates src/lib/subcategory-inference-extensions.ts from category inference rules.
 * Run: node scripts/build-subcategory-extensions.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/lib/subcategory-inference-extensions.ts");

/** Short slug -> taxonomy slug (PRODUCT_SUBCATEGORIES). */
const SLUG_MAP = {
  "bebes": "bebe-bebes",
  "ninos": "bebe-ninos",
  "belleza": "belleza-general",
  "cuidado-personal": "belleza-cuidado-personal",
  "perfumes": "belleza-perfumes",
  "salud": "belleza-salud",
  "coches": "automovil-coches",
  "motos": "automovil-motos",
  "seguridad": "automovil-seguridad",
  "deportes": "deportes-general",
  "aire-libre": "deportes-aire-libre",
  "camping": "deportes-camping",
  "movilidad": "deportes-movilidad",
  "hogar": "hogar-general",
  "hogar-cocina": "hogar-cocina",
  "bano": "hogar-bano",
  "climatizacion": "hogar-climatizacion",
  "decoracion": "hogar-decoracion",
  "descanso": "hogar-descanso",
  "electrodomesticos": "hogar-electrodomesticos",
  "iluminacion": "hogar-iluminacion",
  "limpieza": "hogar-limpieza",
  "muebles": "hogar-muebles",
  "bricolaje": "hogar-bricolaje",
  "herramientas": "hogar-herramientas",
  "ventilacion": "hogar-ventilacion",
  "informatica": "informatica-general",
  "perifericos-componentes": "informatica-perifericos",
  "jardin": "jardin-general",
  "juguetes": "juguetes-general",
  "manualidades": "juguetes-manualidades",
  "modelismo": "juguetes-modelismo",
  "mascotas": "mascotas-general",
  "moda": "moda-general",
  "calzado": "moda-calzado",
  "bolsos-de-mujer": "moda-bolsos-mujer",
  "complementos-de-ropa": "moda-complementos",
  "joyeria": "moda-joyeria",
  "relojes": "moda-relojes",
  "equipaje": "moda-equipaje",
  "electronica": "tecnologia-electronica",
  "moviles": "tecnologia-moviles",
  "audio": "tecnologia-audio",
  "sonido-hi-fi": "tecnologia-hifi",
  "fotografia": "tecnologia-fotografia",
  "televisores": "tecnologia-televisores",
  "accesorios-para-movil": "tecnologia-accesorios-movil",
  "videojuegos": "videojuegos-general",
  "entretenimiento": "videojuegos-entretenimiento",
  "material-escolar": "oficina-material-escolar",
  "papelera": "oficina-papelera",
  "oficina": "oficina-general",
  "supermercado": "otros-supermercado",
  "libros": "otros-libros",
  "musica": "otros-musica",
  "cine-y-series": "otros-cine",
  "viajes": "otros-viajes",
  "codigos-de-descuento": "otros-cupones",
  "actualidad": "otros-actualidad",
  "otros": "otros-general"
};

/** Full category inference rules (~60 categories). */
const categoryInferenceRules = [
  {
    "slug": "bebes",
    "breadcrumbPatterns": [
      "\\bbebe\\b",
      "\\bbebes\\b",
      "\\bpuericultura\\b",
      "\\blactancia\\b",
      "\\bpanales\\b",
      "\\bcochecitos\\b",
      "\\bchupetes\\b",
      "\\bbiberones\\b"
    ],
    "titleKeywords": [
      "pañal",
      "pañales",
      "cochecito",
      "carrito bebe",
      "chupete",
      "biberon",
      "trona",
      "cuna",
      "silla coche",
      "neceser bebe",
      "mochila porteo",
      "esterilizador",
      "vigilabebés",
      "canastilla",
      "badana",
      "bodies bebe",
      "taza aprendizaje",
      "hamaca bebe",
      "parque bebe",
      "chupetero",
      "mordedor",
      "orinal",
      "reductor wc",
      "bolsa carro bebe",
      "cambiador portatil",
      "muselinas",
      "saco dormir bebe",
      "termometro baño",
      "aspirador nasal",
      "canguro bebe"
    ]
  },
  {
    "slug": "ninos",
    "breadcrumbPatterns": [
      "\\bninos\\b",
      "\\binfantil\\b",
      "\\bmoda infantil\\b",
      "\\bjunior\\b"
    ],
    "titleKeywords": [
      "ropa niño",
      "ropa niña",
      "zapato infantil",
      "chandal niño",
      "vestido niña",
      "abrigo infantil",
      "pijama niño",
      "mochila escolar infantil",
      "camisa niño",
      "pantalon infantil",
      "falda niña",
      "sudadera niño",
      "conjunto infantil",
      "babi colegio",
      "impermeable niño",
      "bañador infantil"
    ]
  },
  {
    "slug": "belleza",
    "breadcrumbPatterns": [
      "\\bbelleza\\b",
      "\\bmaquillaje\\b",
      "\\bcosmetica\\b",
      "\\bcosmetica\\b",
      "\\bcuidado facial\\b"
    ],
    "titleKeywords": [
      "labial",
      "mascara de pestañas",
      "base maquillaje",
      "paleta sombras",
      "corrector ojeras",
      "colorete",
      "esmalte uñas",
      "sérum facial",
      "crema antiarrugas",
      "contorno de ojos",
      "iluminador",
      "fijador maquillaje",
      "lapiz labios",
      "delineador ojos",
      "polvos sol",
      "brochas maquillaje",
      "desmaquillante",
      "agua micelar",
      "exfoliante facial",
      "mascarilla facial",
      "crema hidratante cara",
      "bb cream",
      "cc cream",
      "sombra ojos",
      "primer"
    ]
  },
  {
    "slug": "cuidado-personal",
    "breadcrumbPatterns": [
      "\\bcuidado personal\\b",
      "\\bhigiene\\b",
      "\\bdepilacion\\b",
      "\\bcuidado cabello\\b",
      "\\bafeitado\\b"
    ],
    "titleKeywords": [
      "secador pelo",
      "afeitadora",
      "depiladora",
      "cepillo electrico",
      "plancha pelo",
      "recortadora barba",
      "irrigador dental",
      "mascarilla pelo",
      "champú",
      "gel baño",
      "cepillo dental",
      "exfoliante corporal",
      "crema corporal",
      "desodorante",
      "cuchillas afeitar",
      "espuma afeitar",
      "ondulador pelo",
      "moldeador cabello",
      "cepillo alisador",
      "recortadora pelo",
      "hilo dental",
      "enjuague bucal",
      "gel conductor",
      "crema depilatoria",
      "manicura"
    ]
  },
  {
    "slug": "perfumes",
    "breadcrumbPatterns": [
      "\\bperfumes\\b",
      "\\bfragancias\\b",
      "\\bcolonias\\b",
      "\\bperfumeria\\b"
    ],
    "titleKeywords": [
      "perfume",
      "eau de toilette",
      "colonia",
      "fragancia",
      "eau de parfum",
      "estuche regalo perfume",
      "splash corporal",
      "agua de colonia",
      "extracto perfume",
      "perfume hombre",
      "perfume mujer",
      "perfume unisex",
      "tester perfume",
      "miniaturas perfume"
    ]
  },
  {
    "slug": "salud",
    "breadcrumbPatterns": [
      "\\bsalud\\b",
      "\\bfarmacia\\b",
      "\\bparafarmacia\\b",
      "\\bortopedia\\b"
    ],
    "titleKeywords": [
      "tensiómetro",
      "termometro",
      "mascarilla",
      "pulsioximetro",
      "oximetro",
      "glucometro",
      "faja ortopedica",
      "coderas",
      "rodillera",
      "vitaminas",
      "suplemento",
      "pastillero",
      "bastón ortopédico",
      "muletas",
      "cabestrillo",
      "termometro infrarrojos",
      "test antígenos",
      "tiritas",
      "gasas esteriles",
      "alcohol sanitario",
      "agua oxigenada",
      "cojin antiescaras",
      "musletera",
      "tobillera",
      "muñequera ortopedica"
    ]
  },
  {
    "slug": "coches",
    "breadcrumbPatterns": [
      "\\bcoches\\b",
      "\\bautomovil\\b",
      "\\bautomovil\\b",
      "\\bacc. coche\\b",
      "\\bpiezas de coche\\b"
    ],
    "titleKeywords": [
      "alfombrillas coche",
      "soporte movil coche",
      "cargador bateria coche",
      "obd2",
      "fundas asientos coche",
      "rascador hielo",
      "organizador maletero",
      "gato hidraulico",
      "liquido frenos",
      "limpiaparabrisas",
      "arrancador coches",
      "bombillas coche h7",
      "liquido refrigerante",
      "aceite motor",
      "volante coche",
      "funda volante",
      "parasol coche",
      "cadenas nieve",
      "gato coche",
      "espejo angulo muerto"
    ]
  },
  {
    "slug": "motos",
    "breadcrumbPatterns": [
      "\\bmotos\\b",
      "\\bmotocicletas\\b",
      "\\bacc. moto\\b",
      "\\bcascos moto\\b"
    ],
    "titleKeywords": [
      "casco moto",
      "guantes moto",
      "candado disco moto",
      "intermitentes moto",
      "funda moto",
      "chaqueta moto",
      "maleta baul moto",
      "antirrobo moto",
      "pantalla casco",
      "intercomunicador moto",
      "riñonera moto",
      "botas moto",
      "pantalones moto",
      "piton moto",
      "cargador bateria moto",
      "tapa colin"
    ]
  },
  {
    "slug": "seguridad",
    "breadcrumbPatterns": [
      "\\bseguridad vehiculo\\b",
      "\\balarma coche\\b",
      "\\bgps coche\\b"
    ],
    "titleKeywords": [
      "camara dashcam",
      "localizador gps coche",
      "alarma coche",
      "cámara trasera coche",
      "sensor aparcamiento",
      "baston volante",
      "bloqueo freno mano",
      "camara salpicadero",
      "alarma moto",
      "tracker gps"
    ]
  },
  {
    "slug": "deportes",
    "breadcrumbPatterns": [
      "\\bdeportes\\b",
      "\\bfitness\\b",
      "\\bgimnasio\\b",
      "\\bentrenamiento\\b"
    ],
    "titleKeywords": [
      "mancuernas",
      "esterilla yoga",
      "cinta correr",
      "bandas elasticas",
      "barra dominadas",
      "kettlebell",
      "pesas",
      "rueda abdominal",
      "comba crossfit",
      "electroestimulador",
      "banco musculacion",
      "plancha abdominal",
      "pelota pilates",
      "fitball",
      "placas peso",
      "guantes gimnasio",
      "cinturon lumbar",
      "barra pesas",
      "bicicleta estatica",
      "eliptica",
      "remo indoor",
      "saco boxeo"
    ]
  },
  {
    "slug": "aire-libre",
    "breadcrumbPatterns": [
      "\\baire libre\\b",
      "\\boutdoor\\b",
      "\\bsenderismo\\b",
      "\\bmontana\\b"
    ],
    "titleKeywords": [
      "mochila senderismo",
      "bastones trekking",
      "linterna frontal",
      "saco dormir",
      "cantimplora",
      "brújula",
      "prismáticos",
      "gafas sol deportivas",
      "chaqueta softshell",
      "pantalones montaña",
      "botas senderismo",
      "poncho lluvia",
      "filtro agua portatil",
      "reloj gps outdoor",
      "hamaca camping",
      "navaja multiusos"
    ]
  },
  {
    "slug": "camping",
    "breadcrumbPatterns": [
      "\\bcamping\\b",
      "\\bacampada\\b",
      "\\bcaravaning\\b"
    ],
    "titleKeywords": [
      "tienda campaña",
      "colchón hichable",
      "nevera portatil",
      "mueble cocina camping",
      "silla plegable camping",
      "mesa camping",
      "ducha portatil",
      "saco de dormir momia",
      "inflador colchon",
      "estufa portatil gas",
      "linterna camping",
      "vajilla camping",
      "toldo impermeable",
      "piquetas tienda",
      "alfombra camping"
    ]
  },
  {
    "slug": "movilidad",
    "breadcrumbPatterns": [
      "\\bmovilidad urbana\\b",
      "\\bpatinetes electricos\\b",
      "\\bpatinetes\\b",
      "\\bbicicletas\\b"
    ],
    "titleKeywords": [
      "patinete electrico",
      "bicicleta electrica",
      "casco patinete",
      "candado bicicleta",
      "patinete adulto",
      "recambios patinete",
      "hoverboard",
      "ruedas macizas patinete",
      "cargador patinete",
      "timbre bici",
      "alforjas bici",
      "luz bicicleta",
      "monopatín",
      "longboard",
      "patines en linea",
      "uniciclo"
    ]
  },
  {
    "slug": "hogar",
    "breadcrumbPatterns": [
      "\\bhogar\\b",
      "\\bcasa y cocina\\b",
      "\\bordenacion\\b"
    ],
    "titleKeywords": [
      "cojin",
      "cortina",
      "alfombra",
      "organizador",
      "percha",
      "cesta almacenaje",
      "estores",
      "vinilo decorativo",
      "reloj pared",
      "caja organizadora",
      "zapatero tela",
      "perchero pared",
      "separador cajones",
      "fundas sillon",
      "placa puerta",
      "tope puerta",
      "felpudo entrada"
    ]
  },
  {
    "slug": "hogar-cocina",
    "breadcrumbPatterns": [
      "\\bcocina\\b",
      "\\bmenaje\\b",
      "\\butensilios de cocina\\b",
      "\\breposteria\\b"
    ],
    "titleKeywords": [
      "olla",
      "sarten",
      "cafetera",
      "robot cocina",
      "air fryer",
      "paños de cocina",
      "panos de cocina",
      "trapo cocina",
      "cuchillos cocina",
      "bateria de cocina",
      "tapa silicona",
      "tupper",
      "escurridor platos",
      "molde reposteria",
      "picadora alimentos",
      "batidora vaso",
      "tostadora",
      "exprimidor",
      "hervidor agua",
      "mandolina cocina",
      "rallador",
      "tabla cortar",
      "especiero",
      "papel de horno",
      "envasadora vacio",
      "botes cocina",
      "olla presion",
      "sarten antidherente",
      "wok"
    ]
  },
  {
    "slug": "bano",
    "breadcrumbPatterns": [
      "\\bbano\\b",
      "\\bbanos\\b",
      "\\btextil de bano\\b",
      "\\bsancitario bano\\b"
    ],
    "titleKeywords": [
      "toalla baño",
      "alfombrilla baño",
      "dispensador jabon",
      "cortina ducha",
      "escobilla wc",
      "organizador maquillaje baño",
      "espejo aumento baño",
      "estanteria ducha",
      "jabonera",
      "vaso cepillos",
      "toallero",
      "portarrollos wc",
      "alfombra ducha",
      "asiento inodoro",
      "tapa wc",
      "capa baño",
      "albornoz",
      "esponja baño"
    ]
  },
  {
    "slug": "climatizacion",
    "breadcrumbPatterns": [
      "\\bclimatizacion\\b",
      "\\bcalefaccion\\b",
      "\\btratamiento de aire\\b"
    ],
    "titleKeywords": [
      "estufa",
      "radiador",
      "ventilador torre",
      "humidificador",
      "deshumidificador",
      "convector",
      "calefactor ceramico",
      "purificador aire",
      "aire acondicionado",
      "estufa halogeno",
      "emisor termico",
      "radiador aceite",
      "manta electrica",
      "almohadilla termica",
      "termostato inteligente",
      "ionizador aire",
      "enfriador aire"
    ]
  },
  {
    "slug": "decoracion",
    "breadcrumbPatterns": [
      "\\bdecoracion\\b",
      "\\bdecoracion\\b",
      "\\binteriorismo\\b"
    ],
    "titleKeywords": [
      "cuadro",
      "espejo",
      "marco fotos",
      "vela aromatica",
      "florero",
      "jarrón",
      "figura decorativa",
      "planta artificial",
      "cojines decorativos",
      "portavelas",
      "incensario",
      "fuentes decorativas",
      "centro de mesa",
      "vinilo pared",
      "letrero decorativo",
      "lienzos pared",
      "paneles acusticos"
    ]
  },
  {
    "slug": "descanso",
    "breadcrumbPatterns": [
      "\\bdescanso\\b",
      "\\bcolchones\\b",
      "\\bdormitorio\\b",
      "\\bcama\\b"
    ],
    "titleKeywords": [
      "colchon",
      "almohada viscoelastica",
      "somier",
      "canape abatible",
      "protectores de colchon",
      "sábanas",
      "funda nordica",
      "edredon",
      "cabecero cama",
      "cojin cervical",
      "almohada latex",
      "juego sabanas",
      "relleno nordico",
      "colcha verano",
      "base tapizada",
      "patas somier",
      "funda almohada",
      "sobrecolchon"
    ]
  },
  {
    "slug": "electrodomesticos",
    "breadcrumbPatterns": [
      "\\belectrodomesticos\\b",
      "\\belectrodomesticos gran linea\\b",
      "\\belectrodomesticos cocina\\b"
    ],
    "titleKeywords": [
      "lavadora",
      "frigorifico",
      "microondas",
      "lavavajillas",
      "horno",
      "congelador",
      "secadora",
      "vitroceramica",
      "campana extractora",
      "minibar",
      "vinoteca",
      "frigorifico combi",
      "lavadora secadora",
      "placa induccion",
      "horno empotrable",
      "dispensador agua",
      "centro planchado",
      "plancha ropa"
    ]
  },
  {
    "slug": "iluminacion",
    "breadcrumbPatterns": [
      "\\biluminacion\\b",
      "\\blamparas\\b",
      "\\biluminacion led\\b"
    ],
    "titleKeywords": [
      "bombilla led",
      "lampara techo",
      "foco led",
      "tira led",
      "aplique pared",
      "lampara mesa",
      "plafón led",
      "guirnalda luces",
      "linterna",
      "foco exterior",
      "lampara pie",
      "bombilla inteligente",
      "foco carril",
      "luces armario",
      "proyector estrellas",
      "luz nocturna bebe",
      "velas led"
    ]
  },
  {
    "slug": "limpieza",
    "breadcrumbPatterns": [
      "\\blimpieza hogar\\b",
      "\\baspiradoras\\b",
      "\\bproductos de limpieza\\b"
    ],
    "titleKeywords": [
      "aspirador sin cable",
      "robot aspirador",
      "mota polvo",
      "fregona",
      "aspirador mano",
      "escoba electrica",
      "mopa",
      "cubo centrifugo",
      "limpiacristales",
      "aspirador escoba",
      "cepillo vapor",
      "pistola vapor",
      "recambios robot aspirador",
      "mofeta",
      "cubo basura",
      "papelera cocina",
      "escoba y recogedor",
      "limpiador suelos"
    ]
  },
  {
    "slug": "muebles",
    "breadcrumbPatterns": [
      "\\bmuebles\\b",
      "\\bmobiliario\\b",
      "\\bmuebles hogar\\b"
    ],
    "titleKeywords": [
      "mesa escritorio",
      "silla oficina",
      "estanteria",
      "zapatero",
      "comoda",
      "mesita noche",
      "armario",
      "aparador",
      "sillón relax",
      "mesa centro",
      "mueble tv",
      "consola recibidor",
      "silla comedor",
      "mesa comedor",
      "taburete",
      "banco almacenamiento",
      "estanteria modular",
      "libreria",
      "escritorio juvenil"
    ]
  },
  {
    "slug": "bricolaje",
    "breadcrumbPatterns": [
      "\\bbricolaje\\b",
      "\\bferreteria\\b",
      "\\bherramientas electricas\\b"
    ],
    "titleKeywords": [
      "taladro",
      "atornillador",
      "caja herramientas",
      "multitarea",
      "lijadora",
      "sierra circular",
      "pistola termofusible",
      "metro laser",
      "escalera aluminio",
      "amoladora",
      "sierra caladora",
      "cepillo electrico",
      "soldador estaño",
      "pistola calor",
      "recambio lija",
      "brocas taladro",
      "sargento carpintero",
      "maleta herramientas"
    ]
  },
  {
    "slug": "herramientas",
    "breadcrumbPatterns": [
      "\\bherramientas\\b",
      "\\bherramientas manuales\\b"
    ],
    "titleKeywords": [
      "llave inglesa",
      "martillo",
      "nivel laser",
      "destornillador",
      "juego llaves",
      "alicates",
      "sargento",
      "llave carracas",
      "maletin herramientas",
      "llave vaso",
      "cinta metrica",
      "destornillador electrico",
      "llave allen",
      "cortacables",
      "prensa terminales",
      "arco sierra",
      "formon",
      "lima metal"
    ]
  },
  {
    "slug": "ventilacion",
    "breadcrumbPatterns": [
      "\\bventilacion\\b",
      "\\bventiladores\\b",
      "\\bventilacion techo\\b"
    ],
    "titleKeywords": [
      "ventilador techo",
      "ventilador de pie",
      "ventilador de mesa",
      "ventilador box",
      "ventilador usb",
      "aspas ventilador",
      "ventilador suelo",
      "mini ventilador",
      "ventilador pinza",
      "extractor baño"
    ]
  },
  {
    "slug": "informatica",
    "breadcrumbPatterns": [
      "\\binformatica\\b",
      "\\blaptops\\b",
      "\\bordenadores\\b",
      "\\bpcs\\b"
    ],
    "titleKeywords": [
      "portatil",
      "ordenador sobremesa",
      "all in one",
      "macbook",
      "chromebook",
      "mini pc",
      "portatil gaming",
      "torre pc",
      "ultrabook",
      "ordenador oficina",
      "pc custom",
      "apple imac",
      "mac mini",
      "portatil barato",
      "portatil 15 pulgadas",
      "portatil 17 pulgadas"
    ]
  },
  {
    "slug": "perifericos-componentes",
    "breadcrumbPatterns": [
      "\\bperifericos\\b",
      "\\bcomponentes pc\\b",
      "\\bhardware\\b"
    ],
    "titleKeywords": [
      "tarjeta grafica",
      "memoria ram",
      "disco ssd",
      "teclado mecanico",
      "raton gaming",
      "monitor",
      "fuente alimentacion",
      "placa base",
      "procesador cpu",
      "alfombrilla raton xl",
      "webcam",
      "microfono streaming",
      "disco duro externo",
      "hdd 3.5",
      "caja pc",
      "ventilador pc",
      "disipador cpu",
      "pasta termica",
      "tarjeta wifi",
      "hub usb",
      "lector tarjetas",
      "switch ethernet",
      "router wifi",
      "repetidor wifi",
      "cable hdmi",
      "cable displayport",
      "capturadora video"
    ]
  },
  {
    "slug": "jardin",
    "breadcrumbPatterns": [
      "\\bjardin\\b",
      "\\bexterior\\b",
      "\\bterraza y jardin\\b",
      "\\bplantas y macetas\\b"
    ],
    "titleKeywords": [
      "cortacésped",
      "conjunto jardin",
      "tumbona",
      "barbacoa",
      "manguera riego",
      "parasol",
      "toldo",
      "cesped artificial",
      "piscina desmontable",
      "soplador hojas",
      "hidrolimpiadora",
      "muebles terraza",
      "cojines palet",
      "programador riego",
      "aspersor",
      "tijeras podar",
      "cortasetos",
      "motosierra bateria",
      "motocultor",
      "deporadora piscina",
      "cloro piscina",
      "robot limpiafondos",
      "macetero",
      "invernadero",
      "estufa terraza",
      "foco solar jardin",
      "cenador jardin"
    ]
  },
  {
    "slug": "juguetes",
    "breadcrumbPatterns": [
      "\\bjuguetes\\b",
      "\\bjuegos de mesa\\b",
      "\\bjuguetes infantiles\\b"
    ],
    "titleKeywords": [
      "lego",
      "playmobil",
      "muñeca",
      "juego de mesa",
      "coche teledirigido",
      "puzzles",
      "barbie",
      "hot wheels",
      "nerf",
      "peluche",
      "drone juguete",
      "disfraz infantil",
      "cocinita juguete",
      "pista coches",
      "figura accion",
      "bici sin pedales",
      "patinete tres ruedas",
      "casita juguete",
      "plastilina",
      "juego educacion",
      "monopoly",
      "catan",
      "carcassonne",
      "trivial",
      "uno juego cartas"
    ]
  },
  {
    "slug": "manualidades",
    "breadcrumbPatterns": [
      "\\bmanualidades\\b",
      "\\barts and crafts\\b",
      "\\bbricolaje infantil\\b"
    ],
    "titleKeywords": [
      "pistola silicona",
      "set pintura",
      "acuarelas",
      "cartulina",
      "laminas para colorear",
      "arcilla polimérica",
      "rotuladores lettering",
      "lienzo",
      "caballete pintura",
      "pinceles",
      "témperas",
      "foami goma eva",
      "abalorios pulseras",
      "lana punto",
      "hilo ganchillo",
      "papel scrapbooking",
      "pistola cola caliente"
    ]
  },
  {
    "slug": "modelismo",
    "breadcrumbPatterns": [
      "\\bmodelismo\\b",
      "\\bmaquetas\\b",
      "\\bmodelos escala\\b"
    ],
    "titleKeywords": [
      "maqueta para montar",
      "pegamento maquetas",
      "pintura maquetas",
      "aerografo",
      "modelismo ferroviario",
      "piezas fotograbado",
      "maqueta barco",
      "maqueta avion",
      "maqueta coche escala",
      "tamiya",
      "revell",
      "masilla modelismo",
      "cortador styrofoam",
      "pincel fino modelismo"
    ]
  },
  {
    "slug": "mascotas",
    "breadcrumbPatterns": [
      "\\bmascotas\\b",
      "\\bperros y gatos\\b",
      "\\banimales\\b"
    ],
    "titleKeywords": [
      "piensos perro",
      "comida gato",
      "arena gato",
      "correa perro",
      "cama perro",
      "rascador gato",
      "bebedero fuente",
      "antiparasitario perro",
      "champú perro",
      "juguete perro",
      "bolsa excrementos",
      "pienso gato",
      "comida perro",
      "collar adiestramiento",
      "arnes perro",
      "transportin perro",
      "bolso transporte gato",
      "snacks perro",
      "premios gato",
      "pecera",
      "comida peces",
      "jaula hamster",
      "lecho gato",
      "cepillo pelo perro"
    ]
  },
  {
    "slug": "moda",
    "breadcrumbPatterns": [
      "\\bmoda\\b",
      "\\bropa\\b",
      "\\bvestimenta\\b",
      "\\btextil moda\\b"
    ],
    "titleKeywords": [
      "camisa",
      "pantalon",
      "chaqueta",
      "vestido",
      "abrigo",
      "sudadera",
      "jeans",
      "cárdigan",
      "blazer",
      "falda",
      "pijama",
      "camiseta manga corta",
      "jersey cuello alto",
      "trench",
      "parka",
      "cazadora cuero",
      "blusones",
      "short vaquero",
      "leggings",
      "bividi",
      "ropa interior hombre",
      "ropa interior mujer",
      "calcetines",
      "medias"
    ]
  },
  {
    "slug": "calzado",
    "breadcrumbPatterns": [
      "\\bcalzado\\b",
      "\\bzapatos\\b",
      "\\bcalzado hombre mujer\\b"
    ],
    "titleKeywords": [
      "zapatillas deportivas",
      "botas",
      "sandalias",
      "zapatos hombre",
      "zapatos mujer",
      "tacones",
      "mocasines",
      "botines",
      "chancletas",
      "zapatillas casa",
      "sneakers",
      "zapatos oxford",
      "zapatos tacon",
      "alpargatas",
      "zuecos",
      "botas agua",
      "botas montaña",
      "zapatillas running",
      "bamba casual"
    ]
  },
  {
    "slug": "bolsos-de-mujer",
    "breadcrumbPatterns": [
      "\\bbolsos\\b",
      "\\bcarteras mujer\\b",
      "\\bbolsos de mano\\b"
    ],
    "titleKeywords": [
      "bolso mano",
      "mochila mujer",
      "bandolera",
      "cartera mujer",
      "mochila casual",
      "bolso shopper",
      "riñonera mujer",
      "bolso fiesta",
      "bolso saco",
      "cartera mano",
      "monedero mujer",
      "tarjetero mujer",
      "bolso hombro",
      "neceser mujer"
    ]
  },
  {
    "slug": "complementos-de-ropa",
    "breadcrumbPatterns": [
      "\\bcomplementos\\b",
      "\\baccesorios moda\\b",
      "\\bcomplementos moda\\b"
    ],
    "titleKeywords": [
      "cinturon",
      "bufanda",
      "gorro",
      "guantes piel",
      "gafas sol",
      "paraguas",
      "pañuelo cuello",
      "sombrero",
      "gorra beisbol",
      "cinturon cuero",
      "tirantes",
      "bragas cuello",
      "pasamontañas",
      "orejeras invierno",
      "fular",
      "abanico"
    ]
  },
  {
    "slug": "joyeria",
    "breadcrumbPatterns": [
      "\\bjoyeria\\b",
      "\\bjoyas\\b",
      "\\bbisuteria\\b"
    ],
    "titleKeywords": [
      "collar",
      "pulsera",
      "anillo",
      "pendientes",
      "gargantilla",
      "esclava",
      "colgante plata",
      "joyero",
      "anillo compromiso",
      "alianza",
      "pulsera plata",
      "pendientes aro",
      "medalla plata",
      "broche joya",
      "piercing",
      "joyero organizador"
    ]
  },
  {
    "slug": "relojes",
    "breadcrumbPatterns": [
      "\\brelojes\\b",
      "\\breloj\\b",
      "\\bsmartwatches\\b"
    ],
    "titleKeywords": [
      "reloj hombre",
      "reloj mujer",
      "smartwatch",
      "reloj deportivo",
      "reloj pulsera",
      "cronografo",
      "reloj inteligente",
      "reloj automatico",
      "reloj cuarzo",
      "pulsera actividad",
      "smartband",
      "correa reloj",
      "reloj buceo",
      "reloj analogico",
      "reloj digital"
    ]
  },
  {
    "slug": "equipaje",
    "breadcrumbPatterns": [
      "\\bequipaje\\b",
      "\\bmaletas\\b",
      "\\bbolsas de viaje\\b"
    ],
    "titleKeywords": [
      "maleta cabina",
      "juego maletas",
      "bolsa viaje",
      "neceser",
      "funda maleta",
      "mochila portatil viaje",
      "candado tsa",
      "maleta rigida",
      "maleta blanda",
      "bolsa deporte",
      "carro compra",
      "mochila ruedas",
      "riñonera viaje",
      "organizador maleta"
    ]
  },
  {
    "slug": "electronica",
    "breadcrumbPatterns": [
      "\\belectronica\\b",
      "\\bgadgets\\b",
      "\\belectronica consumo\\b"
    ],
    "titleKeywords": [
      "gadget",
      "electronica consumo",
      "multimetro",
      "calculadora cientifica",
      "traductor simultaneo",
      "grabadora voz",
      "visor realidad virtual",
      "gafas vr",
      "puntero laser",
      "estacion meteorologica",
      "grabadora digital",
      "amplificador señal",
      "localizador llaves bluetooth"
    ]
  },
  {
    "slug": "moviles",
    "breadcrumbPatterns": [
      "\\bmoviles\\b",
      "\\bsmartphones\\b",
      "\\btelefonia\\b"
    ],
    "titleKeywords": [
      "smartphone",
      "movil libre",
      "telefono movil",
      "iphone",
      "xiaomi",
      "samsung galaxy",
      "oppo",
      "realme",
      "teléfono básico",
      "redmi",
      "poco phone",
      "oneplus",
      "google pixel",
      "vivo movil",
      "telefono senior",
      "movil resistente",
      "smartphone 5g",
      "celular libre"
    ]
  },
  {
    "slug": "audio",
    "breadcrumbPatterns": [
      "\\baudio\\b",
      "\\baltavoces\\b",
      "\\bauriculares\\b",
      "\\bsonido\\b"
    ],
    "titleKeywords": [
      "altavoz bluetooth",
      "auriculares inalambricos",
      "barra sonido",
      "auriculares diadema",
      "altavoz inteligente",
      "auriculares deportivos",
      "cancelacion ruido",
      "auriculares bluetooth",
      "tws",
      "altavoz portatil",
      "auriculares gaming",
      "radio portatil",
      "radio despertador",
      "altavoz ducha",
      "minicedena",
      "subwoofer"
    ]
  },
  {
    "slug": "sonido-hi-fi",
    "breadcrumbPatterns": [
      "\\bsonido hi-fi\\b",
      "\\bhi-fi\\b",
      "\\baudio hifi\\b"
    ],
    "titleKeywords": [
      "amplificador",
      "tocadiscos",
      "altavoz hifi",
      "receptor av",
      "previo fono",
      "etapa potencia",
      "monitores estudio",
      "reproductor cd hifi",
      "giradiscos",
      "altavoces columna",
      "dac audio",
      "amplificador auriculares",
      "cable hifi",
      "plato vinilo"
    ]
  },
  {
    "slug": "fotografia",
    "breadcrumbPatterns": [
      "\\bfotografia\\b",
      "\\bcamaras\\b",
      "\\bvideo y foto\\b"
    ],
    "titleKeywords": [
      "camara fotos",
      "objetivo camara",
      "trípode",
      "camara deportiva",
      "gopro",
      "flash camara",
      "mochila fotografica",
      "anillo luz led",
      "camara instantanea",
      "polaroid",
      "instax",
      "camara reflex",
      "dslr",
      "mirrorless",
      "estabilizador gimbal",
      "tarjeta sd",
      "tarjeta micro sd",
      "caja luz fotografia",
      "reflector luz",
      "control remoto camara"
    ]
  },
  {
    "slug": "televisores",
    "breadcrumbPatterns": [
      "\\btelevisores\\b",
      "\\btv y video\\b",
      "\\bpantallas tv\\b"
    ],
    "titleKeywords": [
      "televisor led",
      "smart tv",
      "tv 4k",
      "oled tv",
      "soporte tv",
      "proyector cine",
      "pantalla proyeccion",
      "tv stick",
      "fire tv",
      "chromecast",
      "xiaomi tv box",
      "apple tv",
      "television 32",
      "television 55",
      "television 65",
      "qled tv",
      "mando distancia tv",
      "antena tv"
    ]
  },
  {
    "slug": "accesorios-para-movil",
    "breadcrumbPatterns": [
      "\\baccesorios movil\\b",
      "\\bfundas moviles\\b",
      "\\bcargadores movil\\b"
    ],
    "titleKeywords": [
      "funda movil",
      "protector pantalla",
      "cargador usb",
      "power bank",
      "cable tipo c",
      "soporte movil",
      "bateria externa",
      "anillo soporte movil",
      "cristal templado",
      "cargador inalambrico",
      "cargador coche movil",
      "cable lightning",
      "cable microusb",
      "palos selfie",
      "trípode movil",
      "lente movil"
    ]
  },
  {
    "slug": "videojuegos",
    "breadcrumbPatterns": [
      "\\bvideojuegos\\b",
      "\\bgaming\\b",
      "\\bconsolas\\b"
    ],
    "titleKeywords": [
      "juego ps5",
      "juego nintendo switch",
      "juego xbox",
      "consola",
      "mando ps5",
      "volante gaming",
      "silla gaming",
      "tarjeta saldo psn",
      "auriculares gaming",
      "playstation 5",
      "nintendo switch oled",
      "xbox series x",
      "mando xbox",
      "mando ps4",
      "nintendo switch lite",
      "steam deck",
      "asus rog ally",
      "juego ps4",
      "juego xbox one",
      "funda mandos",
      "base carga mandos"
    ]
  },
  {
    "slug": "entretenimiento",
    "breadcrumbPatterns": [
      "\\bentretenimiento\\b",
      "\\bmerchandising\\b",
      "\\bcoleccionismo\\b"
    ],
    "titleKeywords": [
      "figura coleccion",
      "merchandising",
      "funko pop",
      "replica oficial",
      "poster juego",
      "taza friki",
      "camiseta gaming",
      "lampara 3d led",
      "llavero anime",
      "figura anime",
      "gorra gamer",
      "alfombrilla gaming grande",
      "poster anime"
    ]
  },
  {
    "slug": "material-escolar",
    "breadcrumbPatterns": [
      "\\bmaterial escolar\\b",
      "\\bvuelta al cole\\b",
      "\\bcolegio\\b"
    ],
    "titleKeywords": [
      "mochila escolar",
      "estuche",
      "lápices de colores",
      "libreta",
      "boligrafos",
      "compás",
      "témperas",
      "cuaderno espiral",
      "agenda escolar",
      "rotuladores",
      "ceras colores",
      "tijeras infantiles",
      "pegamento barra",
      "portatodo",
      "borrador",
      "sacapuntas",
      "calculadora escolar",
      "carpetas anillas colegio"
    ]
  },
  {
    "slug": "papelera",
    "breadcrumbPatterns": [
      "\\bpapeleria\\b",
      "\\bpapel\\b",
      "\\bproductos de papel\\b"
    ],
    "titleKeywords": [
      "papel din a4",
      "sobres",
      "archivador",
      "carpeta anillas",
      "post-it",
      "etiquetas adhesivas",
      "taladro papel",
      "grapadora",
      "papel fotografico",
      "cuaderno notas",
      "bloc dibujo",
      "taladrador",
      "grapas",
      "clips papel",
      "cinta adhesiva",
      "corrector liquido",
      "marcapaginas"
    ]
  },
  {
    "slug": "oficina",
    "breadcrumbPatterns": [
      "\\boficina\\b",
      "\\bsuministros oficina\\b",
      "\\bequipamiento oficina\\b"
    ],
    "titleKeywords": [
      "destructora papel",
      "calculadora",
      "rotuladora",
      "silla escritorio oficina",
      "pizarra blanca",
      "plastificadora",
      "contador billetes",
      "bandeja documentos",
      "silla director",
      "lámpara escritorio oficina",
      "organizador escritorio",
      "cajonera oficina",
      "alfombrilla escritorio",
      "portanotas",
      "sello automatico"
    ]
  },
  {
    "slug": "supermercado",
    "breadcrumbPatterns": [
      "\\bsupermercado\\b",
      "\\balimentacion y bebidas\\b",
      "\\bgourmet\\b"
    ],
    "titleKeywords": [
      "capsulas cafe",
      "aceite oliva",
      "chocolate",
      "detergente ropa",
      "suavizante",
      "infusiones",
      "galletas",
      "pasta dental",
      "papel higienico",
      "cafe grano",
      "te matcha",
      "frutos secos",
      "snacks",
      "bombones",
      "vino tinto",
      "cerveza",
      "refresco",
      "leche",
      "arroz",
      "pasta italiana",
      "gel ducha familiar",
      "lavavajillas maquina",
      "pastillas lavavajillas"
    ]
  },
  {
    "slug": "libros",
    "breadcrumbPatterns": [
      "\\blibros\\b",
      "\\bliteratura\\b",
      "\\breading\\b"
    ],
    "titleKeywords": [
      "tapa blanda",
      "libro bolsillo",
      "novela",
      "bestseller",
      "libro ilustrado",
      "comic",
      "manga",
      "biografia",
      "libro suspense",
      "novela negra",
      "thriller",
      "libro fantasia",
      "libro infantil",
      "autoayuda",
      "libro cocina",
      "diccionario",
      "poesia"
    ]
  },
  {
    "slug": "musica",
    "breadcrumbPatterns": [
      "\\bmusica\\b",
      "\\bcd y vinilos\\b",
      "\\baudio musica\\b"
    ],
    "titleKeywords": [
      "vinilo",
      "cd musica",
      "disco acetato",
      "album musica",
      "vinilo edicion limitada",
      "cd album",
      "recopilatorio musica"
    ]
  },
  {
    "slug": "cine-y-series",
    "breadcrumbPatterns": [
      "\\bcine\\b",
      "\\bpeliculas\\b",
      "\\bseries tv\\b"
    ],
    "titleKeywords": [
      "pelicula blu-ray",
      "pelicula dvd",
      "boxset serie",
      "coleccion peliculas",
      "trilogia bluray",
      "steelbook",
      "serie completa dvd",
      "pelicula 4k uhd"
    ]
  },
  {
    "slug": "viajes",
    "breadcrumbPatterns": [
      "\\bviajes\\b",
      "\\bequipaje de mano\\b",
      "\\baccesorios viaje\\b"
    ],
    "titleKeywords": [
      "mochila antirrobo",
      "almohada viaje",
      "adaptador enchufe universal",
      "báscula maletas",
      "funda pasaporte",
      "organizador maleta",
      "etiqueta maleta",
      "tapones oidos viaje",
      "antifaz dormir",
      "neceser colgante",
      "riñonera oculta",
      "bolsa impermeable movil",
      "cangurera"
    ]
  },
  {
    "slug": "codigos-de-descuento",
    "breadcrumbPatterns": [
      "\\bcodigos de descuento\\b",
      "\\bcupones\\b"
    ],
    "titleKeywords": [
      "cupon descuento",
      "codigo promocional",
      "vale descuento",
      "oferta flash"
    ]
  },
  {
    "slug": "actualidad",
    "breadcrumbPatterns": [
      "\\bnoticias\\b",
      "\\bactualidad\\b",
      "\\bnovedades\\b"
    ],
    "titleKeywords": [
      "noticia chollo",
      "novedad tecnologia",
      "lanzamiento",
      "analisis producto"
    ]
  },
  {
    "slug": "otros",
    "breadcrumbPatterns": [
      "\\botros\\b",
      "\\bvarios\\b",
      "\\bgeneral\\b"
    ],
    "titleKeywords": [
      "generico",
      "varios",
      "articulo",
      "producto sorpresa",
      "lote ahorro"
    ]
  }
];

function formatRegExp(source) {
  return `/${source}/`;
}

function generateTs() {
  const mapped = categoryInferenceRules.map((rule) => ({
    slug: SLUG_MAP[rule.slug] ?? rule.slug,
    breadcrumbPatterns: rule.breadcrumbPatterns.map(formatRegExp),
    titleKeywords: rule.titleKeywords,
  }));

  const lines = [
    'import type { SubcategoryRule } from "@/lib/subcategory-inference-types";',
    '/** Auto-generated — node scripts/build-subcategory-extensions.mjs */',
    'export const SUBCATEGORY_RULE_EXTENSIONS: SubcategoryRule[] = [',
  ];

  for (const rule of mapped) {
    lines.push("  {");
    lines.push(`    slug: ${JSON.stringify(rule.slug)},`);
    lines.push(`    breadcrumbPatterns: [${rule.breadcrumbPatterns.join(", ")}],`);
    lines.push("    titleKeywords: [");
    for (const kw of rule.titleKeywords) {
      lines.push(`      ${JSON.stringify(kw)},`);
    }
    lines.push("    ],");
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

const ts = generateTs();
writeFileSync(OUT, ts, "utf8");
console.log(`Wrote ${categoryInferenceRules.length} rules to ${OUT}`);
