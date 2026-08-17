/**
 * Formateo de montos en el contexto de un grupo.
 *
 * Un grupo puede definir una moneda secundaria con su cotización, que
 * reemplaza al `USD_RATE = 1.16` hardcodeado de la versión original. Estas
 * funciones encapsulan "primaria + secundaria entre paréntesis" para que
 * ningún componente tenga que saber si el grupo la configuró o no.
 */

import type { Group } from '@shared/types';
import { convertMinorUnits, formatMoney, formatMoneyCompact } from '@shared/money';

export interface MoneyFormatter {
  /** Monto en la moneda del grupo: '€1.234,56' */
  primary: (minorUnits: number) => string;
  /** Sin decimales, para totales grandes: '€1.235' */
  compact: (minorUnits: number) => string;
  /** Equivalente en la moneda secundaria, o null si el grupo no definió una. */
  secondary: (minorUnits: number) => string | null;
  secondaryCompact: (minorUnits: number) => string | null;
  hasSecondary: boolean;
}

export function makeFormatter(group: Group): MoneyFormatter {
  const { currency, secondaryCurrency, secondaryRate } = group;
  const hasSecondary = Boolean(secondaryCurrency && secondaryRate && secondaryRate > 0);

  const toSecondary = (minorUnits: number): number | null => {
    if (!secondaryCurrency || !secondaryRate) return null;
    return convertMinorUnits(minorUnits, currency, secondaryCurrency, secondaryRate);
  };

  return {
    primary: (minorUnits) => formatMoney(minorUnits, currency),
    compact: (minorUnits) => formatMoneyCompact(minorUnits, currency),
    secondary: (minorUnits) => {
      const converted = toSecondary(minorUnits);
      return converted === null ? null : formatMoney(converted, secondaryCurrency as string);
    },
    secondaryCompact: (minorUnits) => {
      const converted = toSecondary(minorUnits);
      return converted === null ? null : formatMoneyCompact(converted, secondaryCurrency as string);
    },
    hasSecondary,
  };
}

/** Porcentaje entero, protegido contra división por cero. */
export function percentOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
