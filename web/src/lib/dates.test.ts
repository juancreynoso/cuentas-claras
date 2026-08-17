import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  formatDateRange,
  formatDateRelative,
  formatDateShort,
  todayISO,
} from './dates';

afterEach(() => {
  vi.useRealTimers();
});

describe('todayISO', () => {
  it('usa la fecha local, no la UTC', () => {
    // 22:30 del 28/03 en Argentina (UTC-3) es ya el 29/03 en UTC. La versión
    // original usaba toISOString() y en ese horario cargaba el gasto un día
    // adelantado; acá tiene que seguir siendo el 28.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T01:30:00Z')); // 22:30 del 28 en UTC-3

    const result = todayISO();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    expect(result).toBe(expected);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDate', () => {
  it('convierte ISO a formato día/mes/año', () => {
    expect(formatDate('2026-03-28')).toBe('28/03/2026');
    expect(formatDate('2026-12-01')).toBe('01/12/2026');
  });

  it('devuelve la entrada tal cual si no es una fecha ISO', () => {
    expect(formatDate('no-es-fecha')).toBe('no-es-fecha');
  });
});

describe('formatDateShort', () => {
  it('muestra día y mes abreviado', () => {
    expect(formatDateShort('2026-03-28')).toBe('28 mar');
    expect(formatDateShort('2026-01-05')).toBe('5 ene');
    expect(formatDateShort('2026-12-31')).toBe('31 dic');
  });
});

describe('formatDateRelative', () => {
  it('dice "hoy" para la fecha actual', () => {
    expect(formatDateRelative(todayISO())).toBe('hoy');
  });

  it('dice "ayer" para el día anterior', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const iso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    expect(formatDateRelative(iso)).toBe('ayer');
  });

  it('incluye el año cuando la fecha es de otro año', () => {
    expect(formatDateRelative('2019-03-28')).toBe('28/03/2019');
  });
});

describe('formatDateRange', () => {
  it('devuelve null sin fechas', () => {
    expect(formatDateRange([])).toBeNull();
  });

  it('muestra una sola fecha cuando todas coinciden', () => {
    expect(formatDateRange(['2026-03-28', '2026-03-28'])).toBe('28 mar');
  });

  it('muestra el rango de la primera a la última, sin importar el orden', () => {
    expect(formatDateRange(['2026-04-02', '2026-03-28', '2026-03-30'])).toBe('28 mar – 2 abr');
  });
});
