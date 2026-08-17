/**
 * Paleta para los avatares de cada integrante.
 *
 * Los colores se asignan por posición al crear el grupo y se guardan en la
 * base, en lugar de derivarse del nombre con un hash: si alguien se renombra,
 * su color no cambia y el grupo no tiene que reaprender quién es quién.
 *
 * Cómo se eligieron, para el tema claro:
 *
 *  1. Veinte tonos equiespaciados en el círculo cromático, con saturación fija.
 *  2. Para cada tono se buscó la luminosidad exacta que da 4.6:1 de contraste
 *     contra el texto blanco de las iniciales — por encima del 4.5:1 que exige
 *     WCAG AA para texto chico. Cada tono necesita una luminosidad distinta
 *     para el mismo contraste: el amarillo debe ser mucho más oscuro que el
 *     azul, y por eso no alcanza con fijar una luminosidad única.
 *  3. El orden no es el del círculo sino el de dispersión punto-más-lejano:
 *     cada color es el que más lejos queda de los ya elegidos. Como
 *     `colorForIndex` asigna por posición, esto hace que un grupo de tres
 *     reciba los tres tonos más distintos posibles, y no tres vecinos.
 */

export const MEMBER_COLORS: readonly string[] = [
  '#c84b43', // rojo
  '#278087', // petróleo
  '#4e8226', // oliva
  '#9a55ce', // violeta
  '#926f2a', // ocre
  '#278637', // verde
  '#4772ca', // azul
  '#c539ad', // magenta
  '#af6033', // terracota
  '#7b7824', // mostaza
  '#667d24', // lima oscuro
  '#338527', // verde hoja
  '#278552', // esmeralda
  '#26836e', // jade
  '#307ba7', // celeste oscuro
  '#6669d3', // índigo
  '#7f61d1', // púrpura
  '#b640c8', // orquídea
  '#c84089', // fucsia
  '#c94665', // frambuesa
] as const;

/** Color para la posición n, ciclando si el grupo excede la paleta. */
export function colorForIndex(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length] as string;
}

/** Iniciales para el avatar: "Juan Cruz" → "JC", "Ana" → "AN". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return [...(parts[0] as string)].slice(0, 2).join('').toLocaleUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((p) => [...p][0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

/** Primer nombre, para las etiquetas donde no cabe el nombre completo. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
