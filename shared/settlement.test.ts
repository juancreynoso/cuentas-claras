import { describe, expect, it } from 'vitest';
import { computeBalances, settle, splitCents, totalCents, totalsByCategory } from './settlement';
import type { Expense } from './types';

/** Constructor de gastos para no repetir los campos que no importan al test. */
function expense(partial: Partial<Expense> & Pick<Expense, 'amountCents' | 'payerId'>): Expense {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    description: partial.description ?? 'gasto',
    amountCents: partial.amountCents,
    spentOn: partial.spentOn ?? '2026-03-28',
    payerId: partial.payerId,
    category: partial.category ?? null,
    participantIds: partial.participantIds ?? [partial.payerId],
    createdAt: partial.createdAt ?? 0,
  };
}

describe('splitCents', () => {
  it('divide en partes iguales cuando el monto es divisible', () => {
    const shares = splitCents(900, ['a', 'b', 'c']);
    expect([...shares.values()]).toEqual([300, 300, 300]);
  });

  it('reparte el resto de a un centavo, sin perder ni inventar', () => {
    // 1000 centavos entre 3 no da exacto: 333,33... por persona.
    const shares = splitCents(1000, ['a', 'b', 'c']);
    expect(shares.get('a')).toBe(334);
    expect(shares.get('b')).toBe(333);
    expect(shares.get('c')).toBe(333);
    expect(shares.get('a')! + shares.get('b')! + shares.get('c')!).toBe(1000);
  });

  it('asigna el resto de forma determinística según el orden de los ids', () => {
    // El mismo gasto, con los participantes en otro orden, debe repartirse
    // igual: si no, los saldos cambiarían según cómo llegaron los datos.
    const a = splitCents(100, ['zoe', 'ana', 'beto']);
    const b = splitCents(100, ['beto', 'zoe', 'ana']);
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it('da todo a la única persona cuando no se comparte', () => {
    expect(splitCents(1234, ['solo']).get('solo')).toBe(1234);
  });

  it('devuelve vacío si no hay participantes', () => {
    expect(splitCents(500, []).size).toBe(0);
  });

  it('conserva el total para cualquier combinación de monto y participantes', () => {
    // Recorremos el espacio donde aparecen los restos: montos que no son
    // múltiplos del número de participantes.
    for (let amount = 1; amount <= 300; amount++) {
      for (let people = 1; people <= 12; people++) {
        const ids = Array.from({ length: people }, (_, i) => `m${i}`);
        const shares = splitCents(amount, ids);
        const sum = [...shares.values()].reduce((a, b) => a + b, 0);
        expect(sum).toBe(amount);
        // Ninguna parte difiere de otra en más de un centavo.
        const values = [...shares.values()];
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('computeBalances', () => {
  const members = ['ana', 'beto', 'caro'];

  it('deja todo en cero si no hay gastos', () => {
    const balances = computeBalances([], members);
    expect(balances.every((b) => b.netCents === 0)).toBe(true);
    expect(balances).toHaveLength(3);
  });

  it('acredita a quien pagó y debita a los participantes', () => {
    const balances = computeBalances(
      [expense({ amountCents: 3000, payerId: 'ana', participantIds: members })],
      members,
    );

    const ana = balances.find((b) => b.memberId === 'ana')!;
    expect(ana.paidCents).toBe(3000);
    expect(ana.oweCents).toBe(1000);
    expect(ana.netCents).toBe(2000);

    expect(balances.find((b) => b.memberId === 'beto')!.netCents).toBe(-1000);
    expect(balances.find((b) => b.memberId === 'caro')!.netCents).toBe(-1000);
  });

  it('no cuenta como deuda a quien no participó del gasto', () => {
    const balances = computeBalances(
      [expense({ amountCents: 1000, payerId: 'ana', participantIds: ['ana', 'beto'] })],
      members,
    );
    expect(balances.find((b) => b.memberId === 'caro')!.netCents).toBe(0);
  });

  it('mantiene la suma de saldos en cero, que es la invariante del sistema', () => {
    const expenses = [
      expense({ amountCents: 1000, payerId: 'ana', participantIds: members }),
      expense({ amountCents: 777, payerId: 'beto', participantIds: ['beto', 'caro'] }),
      expense({ amountCents: 12345, payerId: 'caro', participantIds: members }),
      expense({ amountCents: 1, payerId: 'ana', participantIds: ['beto'] }),
    ];
    const sum = computeBalances(expenses, members).reduce((acc, b) => acc + b.netCents, 0);
    expect(sum).toBe(0);
  });

  it('ignora participantes que no son del grupo, sin desbalancear', () => {
    const balances = computeBalances(
      [expense({ amountCents: 1000, payerId: 'ana', participantIds: ['ana', 'fantasma'] })],
      members,
    );
    // El gasto se reparte sólo entre los integrantes conocidos.
    expect(balances.find((b) => b.memberId === 'ana')!.netCents).toBe(0);
    expect(balances.reduce((acc, b) => acc + b.netCents, 0)).toBe(0);
  });

  it('ignora un gasto cuyo pagador no es del grupo', () => {
    const balances = computeBalances(
      [expense({ amountCents: 1000, payerId: 'fantasma', participantIds: members })],
      members,
    );
    expect(balances.every((b) => b.netCents === 0)).toBe(true);
  });
});

describe('settle', () => {
  it('no propone nada si nadie debe nada', () => {
    expect(settle(computeBalances([], ['ana', 'beto']))).toEqual([]);
  });

  it('resuelve el caso simple con una transferencia', () => {
    const balances = computeBalances(
      [expense({ amountCents: 1000, payerId: 'ana', participantIds: ['ana', 'beto'] })],
      ['ana', 'beto'],
    );
    expect(settle(balances)).toEqual([{ fromId: 'beto', toId: 'ana', amountCents: 500 }]);
  });

  it('cancela deudas cruzadas en lugar de moverlas dos veces', () => {
    // Ana le debe 500 a Beto y Beto le debe 500 a Ana: no hay nada que mover.
    const balances = computeBalances(
      [
        expense({ amountCents: 1000, payerId: 'ana', participantIds: ['ana', 'beto'] }),
        expense({ amountCents: 1000, payerId: 'beto', participantIds: ['ana', 'beto'] }),
      ],
      ['ana', 'beto'],
    );
    expect(settle(balances)).toEqual([]);
  });

  it('usa como máximo n-1 transferencias', () => {
    const members = ['a', 'b', 'c', 'd', 'e', 'f'];
    const balances = computeBalances(
      [
        expense({ amountCents: 6000, payerId: 'a', participantIds: members }),
        expense({ amountCents: 3000, payerId: 'b', participantIds: members }),
        expense({ amountCents: 999, payerId: 'c', participantIds: ['c', 'd'] }),
      ],
      members,
    );
    expect(settle(balances).length).toBeLessThanOrEqual(members.length - 1);
  });

  it('las transferencias saldan exactamente todos los saldos', () => {
    const members = ['ana', 'beto', 'caro', 'dani'];
    const balances = computeBalances(
      [
        expense({ amountCents: 7333, payerId: 'ana', participantIds: members }),
        expense({ amountCents: 1250, payerId: 'beto', participantIds: ['beto', 'caro'] }),
        expense({ amountCents: 4001, payerId: 'dani', participantIds: members }),
        expense({ amountCents: 89, payerId: 'caro', participantIds: ['ana', 'dani'] }),
      ],
      members,
    );

    const transfers = settle(balances);

    // Aplicamos las transferencias sobre los saldos: todo debe quedar en cero.
    const final = new Map(balances.map((b) => [b.memberId, b.netCents]));
    for (const t of transfers) {
      final.set(t.fromId, final.get(t.fromId)! + t.amountCents);
      final.set(t.toId, final.get(t.toId)! - t.amountCents);
    }
    for (const [, net] of final) expect(net).toBe(0);
  });

  it('nunca genera transferencias de monto cero o negativo', () => {
    const members = ['a', 'b', 'c', 'd', 'e'];
    const expenses = [
      expense({ amountCents: 1, payerId: 'a', participantIds: members }),
      expense({ amountCents: 2, payerId: 'b', participantIds: members }),
      expense({ amountCents: 3, payerId: 'c', participantIds: ['a', 'b'] }),
    ];
    for (const t of settle(computeBalances(expenses, members))) {
      expect(t.amountCents).toBeGreaterThan(0);
    }
  });

  it('salda correctamente escenarios generados al azar', () => {
    // Barrido pseudoaleatorio con semilla fija: cubre combinaciones que no se
    // le ocurren a mano, y al fallar es reproducible.
    let seed = 42;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };

    for (let round = 0; round < 200; round++) {
      const memberCount = 2 + random(7);
      const members = Array.from({ length: memberCount }, (_, i) => `m${i}`);

      const expenses: Expense[] = [];
      for (let n = 0; n < 1 + random(10); n++) {
        const participants = members.filter(() => random(2) === 0);
        expenses.push(
          expense({
            amountCents: 1 + random(50_000),
            payerId: members[random(memberCount)] as string,
            participantIds: participants.length > 0 ? participants : [members[0] as string],
          }),
        );
      }

      const balances = computeBalances(expenses, members);
      expect(balances.reduce((acc, b) => acc + b.netCents, 0)).toBe(0);

      const transfers = settle(balances);
      expect(transfers.length).toBeLessThanOrEqual(memberCount - 1);

      const final = new Map(balances.map((b) => [b.memberId, b.netCents]));
      for (const t of transfers) {
        final.set(t.fromId, final.get(t.fromId)! + t.amountCents);
        final.set(t.toId, final.get(t.toId)! - t.amountCents);
      }
      for (const [, net] of final) expect(net).toBe(0);
    }
  });
});

describe('totalCents', () => {
  it('suma todos los gastos', () => {
    expect(
      totalCents([
        expense({ amountCents: 1000, payerId: 'a' }),
        expense({ amountCents: 250, payerId: 'b' }),
      ]),
    ).toBe(1250);
  });

  it('devuelve cero sin gastos', () => {
    expect(totalCents([])).toBe(0);
  });
});

describe('totalsByCategory', () => {
  it('agrupa y ordena de mayor a menor', () => {
    const expenses = [
      expense({ amountCents: 500, payerId: 'a', category: 'comida' }),
      expense({ amountCents: 1500, payerId: 'a', category: 'transporte' }),
      expense({ amountCents: 300, payerId: 'a', category: 'comida' }),
    ];
    const totals = totalsByCategory(expenses, (e) => e.category ?? 'otros');

    expect(totals).toEqual([
      { categoryId: 'transporte', totalCents: 1500, count: 1 },
      { categoryId: 'comida', totalCents: 800, count: 2 },
    ]);
  });
});
