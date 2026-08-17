/**
 * Paleta para los avatares de cada integrante.
 *
 * Los colores se asignan por posición al crear el grupo y se guardan en la
 * base, en lugar de derivarse del nombre con un hash: si alguien se renombra,
 * su color no cambia y el grupo no tiene que reaprender quién es quién.
 *
 * Todos tienen contraste suficiente contra texto oscuro (#0f0f1a), porque las
 * iniciales se dibujan encima del color.
 */

export const MEMBER_COLORS: readonly string[] = [
  '#FF6B6B', // rojo coral
  '#4ECDC4', // turquesa
  '#45B7D1', // celeste
  '#FFA07A', // salmón
  '#98D8C8', // verde agua
  '#C7A0FF', // lavanda
  '#FFD166', // amarillo
  '#F78FB3', // rosa
  '#8ED081', // verde
  '#7FB2F0', // azul claro
  '#FFB4A2', // durazno
  '#B8E0D2', // menta
  '#E7C6FF', // lila
  '#FFCB77', // ámbar
  '#84DCC6', // aguamarina
  '#F5A3C7', // rosa fuerte
  '#A0C4FF', // periwinkle
  '#BDB2FF', // violeta suave
  '#FDFFB6', // lima pálido
  '#9BF6FF', // cyan
] as const;

/** Color para la posición n, ciclando si el grupo excede la paleta. */
export function colorForIndex(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length] as string;
}

/** Iniciales para el avatar: "Juan Cruz" → "JC", "Ana" → "A". */
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
