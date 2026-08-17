/**
 * Cálculo de saldos y liquidación de deudas.
 *
 * Todo opera sobre centavos enteros. La versión original de esta app usaba
 * floats (`monto / participantes.length`), lo que produce dos problemas:
 *
 *   1. Error de representación: 0.1 + 0.2 !== 0.3, y al acumular decenas de
 *      gastos los saldos derivan unos centavos.
 *   2. Centavos que se pierden o se inventan: €10 entre 3 da 3.333... y la suma
 *      de las partes no vuelve a dar €10.
 *
 * Acá el reparto es exacto por construcción: cada gasto se divide en partes
 * enteras y el resto se asigna explícitamente, de forma determinística.
 */

import type { Expense } from './types';

export interface Balance {
  memberId: string;
  /** Total que esta persona puso de su bolsillo. */
  paidCents: number;
  /** Total que le corresponde pagar según su participación en los gastos. */
  oweCents: number;
  /** paidCents - oweCents. Positivo: le deben. Negativo: debe. */
  netCents: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amountCents: number;
}

/**
 * Divide un monto en centavos entre varios participantes sin perder ni
 * inventar centavos: `sum(resultado) === amountCents` siempre.
 *
 * El resto se reparte de a un centavo entre los primeros participantes según
 * el orden de sus ids. Ordenar por id (en lugar de usar el orden de llegada)
 * hace que el mismo gasto se divida siempre igual, en cualquier dispositivo y
 * en cualquier render: los saldos no bailan.
 *
 * Ejemplo: 1000 centavos entre 3 → 334, 333, 333.
 */
export function splitCents(
  amountCents: number,
  participantIds: readonly string[],
): Map<string, number> {
  const shares = new Map<string, number>();
  const n = participantIds.length;
  if (n === 0) return shares;

  const base = Math.floor(amountCents / n);
  let remainder = amountCents - base * n;

  for (const id of [...participantIds].sort()) {
    shares.set(id, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  return shares;
}

/**
 * Calcula el saldo de cada integrante a partir de los gastos.
 *
 * Invariante: `sum(netCents) === 0`. Para garantizarlo se ignoran los
 * participantes que no estén en `memberIds` (la integridad referencial de la
 * base lo evita, pero así la función es total y nunca desbalancea).
 */
export function computeBalances(
  expenses: readonly Expense[],
  memberIds: readonly string[],
): Balance[] {
  const known = new Set(memberIds);
  const paid = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const owe = new Map<string, number>(memberIds.map((id) => [id, 0]));

  for (const expense of expenses) {
    const participants = expense.participantIds.filter((id) => known.has(id));
    if (participants.length === 0 || !known.has(expense.payerId)) continue;

    paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amountCents);
    for (const [id, share] of splitCents(expense.amountCents, participants)) {
      owe.set(id, (owe.get(id) ?? 0) + share);
    }
  }

  return memberIds.map((id) => {
    const paidCents = paid.get(id) ?? 0;
    const oweCents = owe.get(id) ?? 0;
    return { memberId: id, paidCents, oweCents, netCents: paidCents - oweCents };
  });
}

/**
 * Reduce los saldos a una lista de transferencias que salda todo.
 *
 * Heurística greedy: en cada paso, el que más debe le paga al que más le deben.
 * No garantiza el mínimo absoluto de transferencias (ese problema es NP-hard),
 * pero acota el resultado a n-1 transferencias como máximo, porque cada paso
 * salda por completo al menos a una de las dos personas involucradas. Para
 * grupos de viaje reales (menos de 20 personas) el resultado es óptimo o queda
 * a una transferencia del óptimo.
 *
 * El desempate por memberId mantiene la salida estable entre llamadas.
 */
export function settle(balances: readonly Balance[]): Transfer[] {
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ id: b.memberId, amount: -b.netCents }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ id: b.memberId, amount: b.netCents }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i] as { id: string; amount: number };
    const creditor = creditors[j] as { id: string; amount: number };

    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      transfers.push({ fromId: debtor.id, toId: creditor.id, amountCents: amount });
      debtor.amount -= amount;
      creditor.amount -= amount;
    }

    // Avanzamos al que quedó saldado. Si ambos quedaron en cero, avanzan los dos.
    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transfers;
}

/** Total gastado por el grupo. */
export function totalCents(expenses: readonly Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amountCents, 0);
}

/** Total por categoría resuelta, ordenado de mayor a menor. */
export function totalsByCategory(
  expenses: readonly Expense[],
  resolve: (expense: Expense) => string,
): { categoryId: string; totalCents: number; count: number }[] {
  const totals = new Map<string, { totalCents: number; count: number }>();

  for (const expense of expenses) {
    const id = resolve(expense);
    const current = totals.get(id) ?? { totalCents: 0, count: 0 };
    totals.set(id, {
      totalCents: current.totalCents + expense.amountCents,
      count: current.count + 1,
    });
  }

  return [...totals.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId));
}
