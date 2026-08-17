/**
 * Gasto por categoría, con desglose desplegable.
 *
 * Las categorías se infieren de la descripción (ver `@shared/categories`) o se
 * fijan a mano al editar un gasto. Las barras van todas del mismo tono: lo que
 * comunica es el largo, y el emoji ya identifica de qué categoría se trata.
 */

import { useState } from 'react';
import type { Expense, Member } from '@shared/types';
import { getCategory, resolveCategory } from '@shared/categories';
import { totalsByCategory } from '@shared/settlement';
import { firstName } from '@shared/colors';
import { formatDateShort } from '../lib/dates';
import { percentOf, type MoneyFormatter } from '../lib/display';
import { EmptyState } from './ui';
import { IconChevronDown } from './icons';

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
      <dl className="mb-6 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border">
        <Stat label="Gastos" value={String(expenses.length)} />
        <Stat label="Promedio" value={money.compact(average)} />
        <Stat label="Categorías" value={String(totals.length)} />
      </dl>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {totals.map(({ categoryId, totalCents: catTotal, count }) => {
          const category = getCategory(categoryId);
          const isOpen = openCategory === categoryId;
          const items = byCategory.get(categoryId) ?? [];

          return (
            <li key={categoryId} className="bg-canvas">
              <button
                onClick={() => setOpenCategory(isOpen ? null : categoryId)}
                className="w-full px-3.5 py-3 text-left transition-colors hover:bg-surface"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base leading-none" aria-hidden="true">
                    {category.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted">
                      {count} {count === 1 ? 'gasto' : 'gastos'} · {percentOf(catTotal, totalCents)}
                      %
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-bold">{money.primary(catTotal)}</p>
                    {money.hasSecondary && (
                      <p className="font-mono text-[11px] text-muted">
                        {money.secondary(catTotal)}
                      </p>
                    )}
                  </div>
                  <IconChevronDown
                    size={16}
                    className={`shrink-0 text-faint transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>

                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-ink transition-[width] duration-500"
                    style={{ width: `${Math.max(2, (catTotal / maxTotal) * 100)}%` }}
                  />
                </div>
              </button>

              {isOpen && (
                <ul className="animate-fade border-t border-border bg-surface px-3.5">
                  {items.map((expense) => {
                    const payer = byId.get(expense.payerId);
                    return (
                      <li key={expense.id}>
                        <button
                          onClick={() => onEdit(expense)}
                          className="flex w-full items-center justify-between gap-3 border-b border-border py-2.5 text-left last:border-0"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px]">
                              {expense.description}
                            </span>
                            <span className="text-[11px] text-muted">
                              {payer ? firstName(payer.name) : '—'} ·{' '}
                              {formatDateShort(expense.spentOn)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[13px] whitespace-nowrap">
                            {money.primary(expense.amountCents)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas px-3 py-2.5 text-center">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-bold">{value}</dd>
    </div>
  );
}
