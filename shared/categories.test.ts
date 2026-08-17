import { describe, expect, it } from 'vitest';
import { CATEGORIES, getCategory, inferCategory, resolveCategory } from './categories';

describe('inferCategory', () => {
  it('reconoce comida', () => {
    expect(inferCategory('Cena en el centro')).toBe('comida');
    expect(inferCategory('pizza para todos')).toBe('comida');
    expect(inferCategory('Dinner at the port')).toBe('comida');
  });

  it('reconoce transporte', () => {
    expect(inferCategory('Uber al aeropuerto')).toBe('transporte');
    expect(inferCategory('tren a Sevilla')).toBe('transporte');
  });

  it('reconoce alojamiento, entradas, compras, auto y salud', () => {
    expect(inferCategory('Hotel 3 noches')).toBe('alojamiento');
    expect(inferCategory('Entradas al museo')).toBe('entradas');
    expect(inferCategory('Supermercado')).toBe('compras');
    expect(inferCategory('Parking del centro')).toBe('auto');
    expect(inferCategory('Farmacia: ibuprofeno')).toBe('salud');
  });

  it('ignora tildes y mayúsculas', () => {
    expect(inferCategory('CAFÉ')).toBe('comida');
    expect(inferCategory('Excursión al cañón')).toBe('entradas');
    expect(inferCategory('Habitación doble')).toBe('alojamiento');
  });

  it('matchea palabras completas, no fragmentos', () => {
    // "bar" es keyword de comida, pero "barato" no debería activarla.
    expect(inferCategory('souvenir barato')).toBe('compras');
    // "tour" no debe dispararse dentro de otra palabra.
    expect(inferCategory('turno con el peluquero')).toBe('otros');
  });

  it('reconoce el plural de una keyword singular', () => {
    expect(inferCategory('helados en la plaza')).toBe('comida');
    expect(inferCategory('taxis compartidos')).toBe('transporte');
  });

  it('atraviesa la puntuación', () => {
    expect(inferCategory('¡Cena!')).toBe('comida');
    expect(inferCategory('metro (ida y vuelta)')).toBe('transporte');
  });

  it('cae en "otros" cuando no reconoce nada', () => {
    expect(inferCategory('xyzzy')).toBe('otros');
    expect(inferCategory('')).toBe('otros');
    expect(inferCategory('varios')).toBe('otros');
  });
});

describe('resolveCategory', () => {
  it('la categoría manual gana sobre la inferida', () => {
    // La descripción dice "cena", pero el usuario la marcó como transporte.
    expect(resolveCategory('Cena en el aeropuerto', 'transporte')).toBe('transporte');
  });

  it('infiere cuando no hay categoría manual', () => {
    expect(resolveCategory('Cena', null)).toBe('comida');
  });

  it('ignora una categoría manual inexistente y vuelve a inferir', () => {
    expect(resolveCategory('Cena', 'inventada')).toBe('comida');
  });
});

describe('getCategory', () => {
  it('devuelve la categoría por id', () => {
    expect(getCategory('comida').name).toBe('Comida y bebida');
  });

  it('cae en "otros" con un id desconocido', () => {
    expect(getCategory('no-existe').id).toBe('otros');
  });

  it('todas las categorías tienen id único, nombre e icono', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const category of CATEGORIES) {
      expect(category.name).toBeTruthy();
      expect(category.icon).toBeTruthy();
    }
  });

  it('ninguna keyword está repetida entre categorías', () => {
    // Una keyword duplicada haría que el resultado dependa del orden del array.
    const seen = new Map<string, string>();
    for (const category of CATEGORIES) {
      for (const keyword of category.keywords) {
        const previous = seen.get(keyword);
        expect(previous, `"${keyword}" está en ${previous} y en ${category.id}`).toBeUndefined();
        seen.set(keyword, category.id);
      }
    }
  });
});
