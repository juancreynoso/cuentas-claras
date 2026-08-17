/**
 * Conversión y formateo de dinero.
 *
 * Los montos se guardan como enteros en la unidad menor de la moneda
 * (centavos para EUR/USD, unidades enteras para JPY/CLP/COP). El paso a
 * decimal ocurre únicamente en los bordes: al formatear para mostrar y al
 * parsear lo que escribe el usuario.
 */

import { getCurrency, minorUnitFactor } from './currencies';

/** Formatea un monto en unidad menor como texto con símbolo de moneda. */
export function formatMoney(minorUnits: number, currency: string, locale = 'es-ES'): string {
  const { decimals } = getCurrency(currency);
  const value = minorUnits / minorUnitFactor(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Moneda que Intl no reconoce: caemos a un formato simple y explícito.
    return `${currency} ${value.toFixed(decimals)}`;
  }
}

/** Como formatMoney pero sin decimales, para totales y gráficos compactos. */
export function formatMoneyCompact(minorUnits: number, currency: string, locale = 'es-ES'): string {
  const value = minorUnits / minorUnitFactor(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value)}`;
  }
}

/**
 * Convierte un monto a la moneda secundaria del grupo.
 * Redondea al entero de unidad menor más cercano.
 */
export function convertMinorUnits(
  minorUnits: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number {
  const value = (minorUnits / minorUnitFactor(fromCurrency)) * rate;
  return Math.round(value * minorUnitFactor(toCurrency));
}

/**
 * Parsea lo que el usuario escribe a unidad menor.
 *
 * Acepta coma o punto como separador decimal, porque quien escribe en español
 * pone "12,50" con la misma naturalidad que "12.50". Devuelve `null` si el
 * texto no es un monto válido.
 *
 * El cálculo trabaja sobre los dígitos como texto y nunca multiplica un float.
 * La versión obvia, `Math.round(Number(texto) * 100)`, falla en casos reales:
 * 1.005 se representa como 1.00499999999999989, así que *100 da 100.4999... y
 * redondea a 100 en lugar de 101. Concatenando dígitos el resultado es exacto.
 */
export function parseMoneyToMinor(input: string, currency: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  // Un solo separador decimal, punto o coma, y sólo dígitos alrededor.
  if (!/^\d+([.,]\d*)?$/.test(cleaned)) return null;

  const [integerPart = '', fractionPart = ''] = cleaned.replace(',', '.').split('.');
  const { decimals } = getCurrency(currency);

  // Recortamos o rellenamos la parte decimal a la precisión de la moneda.
  const kept = fractionPart.slice(0, decimals).padEnd(decimals, '0');
  const base = Number(integerPart + kept);
  if (!Number.isSafeInteger(base)) return null;

  // Redondeo hacia arriba si el primer dígito descartado es 5 o más.
  const firstDropped = fractionPart[decimals];
  const roundUp = firstDropped !== undefined && Number(firstDropped) >= 5;

  return base + (roundUp ? 1 : 0);
}

/** Representación editable de un monto, para precargar un input. */
export function minorToInputValue(minorUnits: number, currency: string): string {
  const { decimals } = getCurrency(currency);
  return (minorUnits / minorUnitFactor(currency)).toFixed(decimals);
}
