/**
 * Gasto por categoría, con desglose desplegable.
 *
 * Las categorías se infieren de la descripción (ver `@shared/categories`) o se
 * fijan a mano al editar un gasto.
 */

import { useState } from 'react';
import type { Expense, Member } from '@shared/types';
import { getCategory, resolveCategory } from '@shared/categories';
import { totalsByCategory } from '@shared/settlement';
import { firstName } from '@shared/colors';
import { formatDateShort } from '../lib/dates';
import { percentOf, type MoneyFormatter } from '../lib/display';
import { EmptyState } from './ui';

interface Props {
  expenses: Expense[];
  members: Member[];
  money: MoneyFormatter;
  totalCents: number;
  onEdit: (expense: Expense) => void;
}

export function StatsTab({ expenses, members, money, totalCents, onEdit }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Sin datos todavía"
        description="Cuando cargues gastos vas a ver en qué se fue la plata."
      />
    );
  }

  const totals = totalsByCategory(expenses, (e) => resolveCategory(e.description, e.category));
  const maxTotal = totals[0]?.totalCents ?? 1;
  const byId = new Map(members.map((m) => [m.id, m]));

  const byCategory = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const id = resolveCategory(expense.description, expense.category);
    const list = byCategory.get(id);
    if (list) list.push(expense);
    else byCategory.set(id, [expense]);
  }

  const average = Math.round(totalCents / expenses.length);

  return (
    <div>
      <dl className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="Gastos" value={String(expenses.length)} />
        <Stat label="Promedio" value={money.compact(average)} />
        <Stat label="Categorías" value={String(totals.length)} accent />
      </dl>

      <ul className="space-y-2.5">
        {totals.map(({ categoryId, totalCents: catTotal, count }) => {
          const category = getCategory(categoryId);
          const isOpen = openCategory === categoryId;
          const items = byCategory.get(categoryId) ?? [];

          return (
            <li key={categoryId}>
              <div
                className={`rounded-card border bg-surface p-4 transition-colors ${
                  isOpen ? 'border-accent/40' : 'border-border'
                }`}
              >
                <button
                  onClick={() => setOpenCategory(isOpen ? null : categoryId)}
                  className="w-full text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: `${category.color}22` }}
                      aria-hidden="true"
                    >
                      {category.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{category.name}</p>
                      <p className="text-[11px] text-muted">
                        {count} {count === 1 ? 'gasto' : 'gastos'} ·{' '}
                        {percentOf(catTotal, totalCents)}% del total
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="font-mono text-base font-bold"
                        style={{ color: category.color }}
                      >
                        {money.primary(catTotal)}
                      </p>
                      {money.hasSecondary && (
                        <p className="font-mono text-[10px] text-muted">
                          {money.secondary(catTotal)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(2, (catTotal / maxTotal) * 100)}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                </button>

                {isOpen && (
                  <ul className="animate-fade mt-3 border-t border-border pt-2">
                    {items.map((expense) => {
                      const payer = byId.get(expense.payerId);
                      return (
                        <li key={expense.id}>
                          <button
                            onClick={() => onEdit(expense)}
                            className="flex w-full items-center justify-between gap-3 border-b border-border-soft py-2 text-left last:border-0"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] text-white/85">
                                {expense.description}
                              </span>
                              <span className="text-[11px] text-muted">
                                {payer ? firstName(payer.name) : '—'} ·{' '}
                                {formatDateShort(expense.spentOn)}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-[13px] whitespace-nowrap text-money">
                              {money.primary(expense.amountCents)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-ink-raised px-3 py-2.5 text-center">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm font-bold ${accent ? 'text-accent' : 'text-money'}`}>
        {value}
      </dd>
    </div>
  );
}
