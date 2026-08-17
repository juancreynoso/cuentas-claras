/**
 * Monedas soportadas. El backend valida contra esta lista y el cliente la usa
 * para el selector.
 *
 * `decimals` importa: yen, peso chileno y peso colombiano no tienen unidad
 * menor, así que para ellos el "monto en centavos" es directamente el monto
 * entero. Sin esto, ¥1000 se mostraría como ¥10,00.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  decimals: 0 | 2;
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  { code: 'USD', symbol: '$', name: 'Dólar estadounidense', decimals: 2 },
  { code: 'ARS', symbol: '$', name: 'Peso argentino', decimals: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Real brasileño', decimals: 2 },
  { code: 'CLP', symbol: '$', name: 'Peso chileno', decimals: 0 },
  { code: 'COP', symbol: '$', name: 'Peso colombiano', decimals: 0 },
  { code: 'MXN', symbol: '$', name: 'Peso mexicano', decimals: 2 },
  { code: 'PEN', symbol: 'S/', name: 'Sol peruano', decimals: 2 },
  { code: 'UYU', symbol: '$U', name: 'Peso uruguayo', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'Libra esterlina', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', name: 'Franco suizo', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Yen japonés', decimals: 0 },
  { code: 'CAD', symbol: 'CA$', name: 'Dólar canadiense', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Dólar australiano', decimals: 2 },
  { code: 'CNY', symbol: 'CN¥', name: 'Yuan chino', decimals: 2 },
  { code: 'THB', symbol: '฿', name: 'Baht tailandés', decimals: 2 },
  { code: 'TRY', symbol: '₺', name: 'Lira turca', decimals: 2 },
  { code: 'ZAR', symbol: 'R', name: 'Rand sudafricano', decimals: 2 },
] as const;

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

const FALLBACK: Currency = { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 };

export function isValidCurrency(code: unknown): code is string {
  return typeof code === 'string' && BY_CODE.has(code);
}

export function getCurrency(code: string): Currency {
  return BY_CODE.get(code) ?? FALLBACK;
}

export function currencySymbol(code: string): string {
  return getCurrency(code).symbol;
}

/** Cuántas unidades menores tiene una unidad de esta moneda: 100 o 1. */
export function minorUnitFactor(code: string): number {
  return getCurrency(code).decimals === 0 ? 1 : 100;
}
