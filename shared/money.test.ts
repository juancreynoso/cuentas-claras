import { describe, expect, it } from 'vitest';
import {
  convertMinorUnits,
  formatMoney,
  formatMoneyCompact,
  minorToInputValue,
  parseMoneyToMinor,
} from './money';
import { CURRENCIES, getCurrency, minorUnitFactor } from './currencies';

describe('parseMoneyToMinor', () => {
  it('parsea decimales con punto', () => {
    expect(parseMoneyToMinor('12.50', 'EUR')).toBe(1250);
  });

  it('parsea decimales con coma, como se escribe en español', () => {
    expect(parseMoneyToMinor('12,50', 'EUR')).toBe(1250);
  });

  it('parsea enteros', () => {
    expect(parseMoneyToMinor('40', 'EUR')).toBe(4000);
  });

  it('evita el error de redondeo del float', () => {
    // 19.99 * 100 en punto flotante da 1998.9999999999998.
    expect(parseMoneyToMinor('19.99', 'EUR')).toBe(1999);
    expect(parseMoneyToMinor('0.29', 'EUR')).toBe(29);
    expect(parseMoneyToMinor('1.005', 'EUR')).toBe(101);
  });

  it('trata las monedas sin decimales como unidades enteras', () => {
    expect(parseMoneyToMinor('1000', 'JPY')).toBe(1000);
    expect(parseMoneyToMinor('5000', 'CLP')).toBe(5000);
  });

  it('ignora espacios alrededor', () => {
    expect(parseMoneyToMinor('  25,00  ', 'EUR')).toBe(2500);
  });

  it('rechaza lo que no es un monto', () => {
    for (const invalid of ['', '   ', 'abc', '-5', '1.2.3', '1,2,3', '12€', '1e5', '.', ',']) {
      expect(parseMoneyToMinor(invalid, 'EUR'), invalid).toBeNull();
    }
  });

  it('acepta cero (la validación de "mayor que cero" es del formulario)', () => {
    expect(parseMoneyToMinor('0', 'EUR')).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formatea con el símbolo de la moneda', () => {
    // El separador exacto depende de la locale de Intl, así que sólo
    // verificamos que el símbolo y los dígitos estén presentes.
    const formatted = formatMoney(123456, 'EUR');
    expect(formatted).toContain('€');
    expect(formatted).toMatch(/1[.,\s]?234/);
  });

  it('no muestra decimales en monedas que no los tienen', () => {
    const formatted = formatMoney(1000, 'JPY');
    expect(formatted).not.toMatch(/[.,]\d\d/);
  });

  it('formatea cero', () => {
    expect(formatMoney(0, 'EUR')).toContain('0');
  });

  it('la versión compacta no lleva decimales', () => {
    expect(formatMoneyCompact(123456, 'EUR')).not.toMatch(/,\d\d/);
  });
});

describe('minorToInputValue', () => {
  it('devuelve un valor editable con los decimales de la moneda', () => {
    expect(minorToInputValue(1250, 'EUR')).toBe('12.50');
    expect(minorToInputValue(1000, 'JPY')).toBe('1000');
  });

  it('hace ida y vuelta sin perder precisión', () => {
    for (const currency of ['EUR', 'USD', 'JPY', 'CLP', 'ARS']) {
      for (const amount of [1, 99, 100, 12345, 999999]) {
        expect(parseMoneyToMinor(minorToInputValue(amount, currency), currency)).toBe(amount);
      }
    }
  });
});

describe('convertMinorUnits', () => {
  it('convierte entre monedas de dos decimales', () => {
    // €10,00 a 1,16 → US$11,60
    expect(convertMinorUnits(1000, 'EUR', 'USD', 1.16)).toBe(1160);
  });

  it('ajusta la escala al pasar a una moneda sin decimales', () => {
    // €10,00 a 160 yenes por euro → ¥1600
    expect(convertMinorUnits(1000, 'EUR', 'JPY', 160)).toBe(1600);
  });

  it('ajusta la escala al pasar de una moneda sin decimales', () => {
    // ¥1000 a 0,0062 euros por yen → €6,20
    expect(convertMinorUnits(1000, 'JPY', 'EUR', 0.0062)).toBe(620);
  });

  it('redondea al centavo más cercano', () => {
    expect(convertMinorUnits(333, 'EUR', 'USD', 1.16)).toBe(386); // 3.8628 → 3.86
  });
});

describe('catálogo de monedas', () => {
  it('no tiene códigos repetidos', () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('usa códigos ISO de tres letras y símbolo no vacío', () => {
    for (const currency of CURRENCIES) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/);
      expect(currency.symbol.length).toBeGreaterThan(0);
      expect([0, 2]).toContain(currency.decimals);
    }
  });

  it('el factor de unidad menor concuerda con los decimales', () => {
    for (const currency of CURRENCIES) {
      expect(minorUnitFactor(currency.code)).toBe(currency.decimals === 0 ? 1 : 100);
    }
  });

  it('cae en EUR ante una moneda desconocida, en lugar de romper', () => {
    expect(getCurrency('XXX').code).toBe('EUR');
  });
});
