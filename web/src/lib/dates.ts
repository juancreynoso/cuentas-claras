/**
 * Fechas.
 *
 * Los gastos guardan la fecha como 'YYYY-MM-DD' sin hora ni zona: un gasto
 * ocurre "el 28 de marzo", no "el 28 de marzo a las 03:00 UTC". Por eso todo
 * el parseo es explícito por componentes y nunca pasa por `new Date(iso)`,
 * que interpreta el string como UTC y puede correr la fecha un día.
 */

/**
 * Fecha de hoy en la zona del usuario.
 *
 * La versión original usaba `new Date().toISOString().split('T')[0]`, que
 * devuelve la fecha en UTC: para alguien en Argentina (UTC-3) cargando un
 * gasto a las 22:00, ese cálculo ya marcaba el día siguiente.
 */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parts(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** 'YYYY-MM-DD' → '28/03/2026' */
export function formatDate(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** 'YYYY-MM-DD' → '28 mar' */
export function formatDateShort(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${p.day} ${MONTHS_SHORT[p.month - 1] ?? ''}`.trim();
}

/** 'hoy' / 'ayer' / '28 mar', para que la lista se lea de un vistazo. */
export function formatDateRelative(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'hoy';

  const p = parts(iso);
  if (!p) return iso;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (iso === yesterdayISO) return 'ayer';

  // Si es de otro año, mostramos el año para que no confunda.
  const currentYear = new Date().getFullYear();
  return p.year === currentYear ? formatDateShort(iso) : formatDate(iso);
}

/** Etiqueta legible del rango de fechas de un viaje. */
export function formatDateRange(isoDates: readonly string[]): string | null {
  if (isoDates.length === 0) return null;
  const sorted = [...isoDates].sort();
  const first = sorted[0] as string;
  const last = sorted[sorted.length - 1] as string;
  if (first === last) return formatDateShort(first);
  return `${formatDateShort(first)} – ${formatDateShort(last)}`;
}
