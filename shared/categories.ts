/**
 * Categorización automática por palabras clave sobre la descripción del gasto.
 *
 * La versión original tenía keywords atadas a un viaje puntual ("alhambra",
 * "gibraltar", "plaza de toros"). Acá quedaron sólo términos genéricos, en
 * español y en inglés, para que sirva en cualquier viaje. El usuario siempre
 * puede fijar la categoría a mano y eso gana sobre la inferencia.
 */

/**
 * Una categoría no lleva color: la interfaz es monocroma y el emoji ya
 * alcanza para identificarla de un vistazo en la lista.
 */
export interface Category {
  id: string;
  name: string;
  icon: string;
  keywords: readonly string[];
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'comida',
    name: 'Comida y bebida',
    icon: '🍽️',
    keywords: [
      'cena', 'almuerzo', 'desayuno', 'comida', 'merienda', 'restaurant', 'resto',
      'sushi', 'pizza', 'pasta', 'burger', 'hamburguesa', 'helado', 'sandwich',
      'sanguche', 'cafe', 'bar', 'trago', 'cerveza', 'birra', 'vino', 'copa',
      'coctel', 'gaseosa', 'jugo', 'bebida', 'agua', 'postre', 'tapa', 'brunch',
      'panaderia', 'pasteleria', 'delivery', 'picada', 'asado', 'parrilla',
      'dinner', 'lunch', 'breakfast', 'food', 'drink', 'beer', 'wine', 'coffee',
      'snack', 'dessert', 'groceries dinner',
    ],
  },
  {
    id: 'transporte',
    name: 'Transporte',
    icon: '🚗',
    keywords: [
      'uber', 'cabify', 'didi', 'taxi', 'remis', 'colectivo', 'bondi', 'bus',
      'micro', 'tren', 'metro', 'subte', 'tranvia', 'ferry', 'barco', 'transfer',
      'combustible', 'nafta', 'gasolina', 'gasoil', 'diesel', 'bici', 'scooter',
      'moto', 'vuelo', 'avion', 'aeropuerto', 'equipaje', 'valija', 'pasaje',
      'boleto', 'flight', 'train', 'subway', 'fuel', 'gas station', 'ticket bus',
      'luggage', 'baggage',
    ],
  },
  {
    id: 'alojamiento',
    name: 'Alojamiento',
    icon: '🏨',
    keywords: [
      'hotel', 'hostel', 'airbnb', 'alojamiento', 'habitacion', 'cuarto',
      'apart', 'apartamento', 'departamento', 'cabana', 'camping', 'noche',
      'checkin', 'check in', 'booking', 'reserva', 'hospedaje', 'posada',
      'guesthouse', 'lodging', 'room', 'stay',
    ],
  },
  {
    id: 'entradas',
    name: 'Entradas y turismo',
    icon: '🎟️',
    keywords: [
      'entrada', 'entradas', 'ticket', 'museo', 'catedral', 'iglesia',
      'monumento', 'tour', 'guia', 'visita', 'excursion', 'paseo', 'parque',
      'torre', 'castillo', 'palacio', 'ruinas', 'mirador', 'teatro', 'concierto',
      'recital', 'show', 'espectaculo', 'festival', 'zoo', 'acuario', 'termas',
      'spa', 'buceo', 'snorkel', 'trekking', 'museum', 'admission', 'sightseeing',
      'concert', 'attraction',
    ],
  },
  {
    id: 'compras',
    name: 'Compras y mercado',
    icon: '🛍️',
    keywords: [
      'super', 'supermercado', 'mercado', 'almacen', 'kiosco', 'kiosko',
      'tienda', 'shopping', 'mall', 'ropa', 'zapatos', 'campera',
      'souvenir', 'regalo', 'artesania', 'libreria', 'electronica', 'cargador',
      'adaptador', 'supermarket', 'grocery', 'groceries', 'pharmacy', 'clothes',
      'gift', 'store',
    ],
  },
  {
    id: 'auto',
    name: 'Auto y parking',
    icon: '🅿️',
    keywords: [
      'estacionamiento', 'parking', 'garage', 'garaje', 'cochera', 'peaje',
      'autopista', 'alquiler de auto', 'rent a car', 'rental', 'multa', 'lavadero',
      'taller', 'neumatico', 'seguro auto', 'toll', 'car rental', 'fine',
    ],
  },
  {
    id: 'salud',
    name: 'Salud y farmacia',
    icon: '💊',
    keywords: [
      'farmacia', 'medico', 'doctor', 'hospital', 'clinica', 'guardia', 'remedio',
      'medicamento', 'analgesico', 'ibuprofeno', 'paracetamol', 'curita',
      'protector solar', 'repelente', 'seguro de viaje', 'vacuna', 'dentista',
      'medicine', 'insurance', 'sunscreen',
    ],
  },
  {
    id: 'otros',
    name: 'Otros',
    icon: '📦',
    keywords: [],
  },
] as const;

export const CATEGORY_IDS: readonly string[] = CATEGORIES.map((c) => c.id);

const OTHER = CATEGORIES[CATEGORIES.length - 1] as Category;

/** Quita tildes y pasa a minúsculas, para que "café" matchee "cafe". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

// Pre-normalizamos las keywords una sola vez al cargar el módulo en lugar de
// hacerlo en cada llamada, que era lo que pasaba en la versión original.
const NORMALIZED: readonly { id: string; keywords: string[] }[] = CATEGORIES.filter(
  (c) => c.id !== OTHER.id,
).map((c) => ({ id: c.id, keywords: c.keywords.map(normalize) }));

/**
 * Infiere la categoría de un gasto por su descripción.
 * Matchea por palabra completa para que "bar" no dispare con "barato".
 */
export function inferCategory(description: string): string {
  const haystack = ` ${normalize(description).replace(/[^a-z0-9\s]/g, ' ')} `;
  for (const cat of NORMALIZED) {
    for (const kw of cat.keywords) {
      if (haystack.includes(` ${kw} `) || haystack.includes(` ${kw}s `)) return cat.id;
    }
  }
  return OTHER.id;
}

/** Categoría fijada a mano si existe; si no, la inferida. */
export function resolveCategory(description: string, manual: string | null): string {
  if (manual && CATEGORY_IDS.includes(manual)) return manual;
  return inferCategory(description);
}

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? OTHER;
}
