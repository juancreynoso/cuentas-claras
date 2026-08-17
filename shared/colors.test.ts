import { describe, expect, it } from 'vitest';
import { MEMBER_COLORS, colorForIndex, firstName, initials } from './colors';

describe('colorForIndex', () => {
  it('da un color distinto a cada posición de la paleta', () => {
    const used = MEMBER_COLORS.map((_, i) => colorForIndex(i));
    expect(new Set(used).size).toBe(MEMBER_COLORS.length);
  });

  it('cicla cuando el grupo supera la paleta', () => {
    expect(colorForIndex(MEMBER_COLORS.length)).toBe(colorForIndex(0));
    expect(colorForIndex(MEMBER_COLORS.length + 3)).toBe(colorForIndex(3));
  });

  it('todos los colores son hexadecimales válidos', () => {
    for (const color of MEMBER_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('initials', () => {
  it('toma la inicial del nombre y del apellido', () => {
    expect(initials('Juan Cruz')).toBe('JC');
    expect(initials('Maria Fernanda Lopez')).toBe('MF');
  });

  it('toma dos letras cuando hay un solo nombre', () => {
    expect(initials('Ana')).toBe('AN');
    expect(initials('Bo')).toBe('BO');
  });

  it('maneja un nombre de una sola letra', () => {
    expect(initials('X')).toBe('X');
  });

  it('tolera espacios de más', () => {
    expect(initials('  Juan   Cruz  ')).toBe('JC');
  });

  it('devuelve un marcador en lugar de romper con texto vacío', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });

  it('funciona con acentos y con emoji', () => {
    expect(initials('Ángel Ñuñez')).toBe('ÁÑ');
    // Un emoji es más de un code unit: iterar por code points evita cortarlo.
    expect(initials('🎉 Fiesta')).toBe('🎉F');
  });
});

describe('firstName', () => {
  it('devuelve la primera palabra', () => {
    expect(firstName('Juan Cruz Reynoso')).toBe('Juan');
    expect(firstName('Ana')).toBe('Ana');
  });

  it('tolera espacios alrededor', () => {
    expect(firstName('  Juan  Cruz ')).toBe('Juan');
  });
});
