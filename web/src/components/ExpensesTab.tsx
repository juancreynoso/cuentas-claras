/**
 * Listado de gastos, agrupados por fecha.
 *
 * Agrupar por día (en lugar de una lista plana como en el original) hace que
 * al final del viaje se pueda reconstruir mentalmente cada jornada.
 */

import type { Expense, Member } from '@shared/types';
import { firstName } from '@shared/colors';
import { getCategory, resolveCategory } from '@shared/categories';
import { splitCents } from '@shared/settlement';
import { formatDateRelative } from '../lib/dates';
import type { MoneyFormatter } from '../lib/display';
import { Avatar, EmptyState } from './ui';

interface Props {
  expenses: Expense[];
  members: Member[];
  money: MoneyFormatter;
  onEdit: (expense: Expense) => void;
}

export function ExpensesTab({ expenses, members, money, onEdit }: Props) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="🧾"
        title="Todavía no hay gastos"
        description="Tocá el botón + para cargar el primero."
      />
    );
  }

  const byId = new Map(members.map((m) => [m.id, m]));

  // Los gastos ya vienen del servidor ordenados por fecha descendente, así que
  // recorrerlos en orden alcanza para armar los grupos por día.
  const days: { date: string; items: Expense[] }[] = [];
  for (const expense of expenses) {
    const last = days[days.length - 1];
    if (last && last.date === expense.spentOn) last.items.push(expense);
    else days.push({ date: expense.spentOn, items: [expense] });
  }

  return (
    <div className="space-y-5">
      {days.map((day) => {
        const dayTotal = day.items.reduce((sum, e) => sum + e.amountCents, 0);
        return (
          <section key={day.date}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                {formatDateRelative(day.date)}
              </h3>
              <span className="font-mono text-[11px] text-muted-dim">
                {money.compact(dayTotal)}
              </span>
            </div>
            <ul className="space-y-2">
              {day.items.map((expense) => (
                <li key={expense.id}>
                  <ExpenseCard
                    expense={expense}
                    payer={byId.get(expense.payerId)}
                    members={members}
                    money={money}
                    onEdit={() => onEdit(expense)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ExpenseCard({
  expense,
  payer,
  members,
  money,
  onEdit,
}: {
  expense: Expense;
  payer: Member | undefined;
  members: Member[];
  money: MoneyFormatter;
  onEdit: () => void;
}) {
  const category = getCategory(resolveCategory(expense.description, expense.category));
  const shares = splitCents(expense.amountCents, expense.participantIds);
  const byId = new Map(members.map((m) => [m.id, m]));

  const everyone = expense.participantIds.length === members.length;
  const perPerson =
    expense.participantIds.length > 0
      ? Math.round(expense.amountCents / expense.participantIds.length)
      : 0;

  return (
    <button
      onClick={onEdit}
      className="animate-rise w-full rounded-card border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-accent/40"
      aria-label={`Editar gasto: ${expense.description}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm" aria-hidden="true">
              {category.icon}
            </span>
            <p className="truncate text-[15px] font-semibold">{expense.description}</p>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            {payer && <Avatar name={payer.name} color={payer.color} size="sm" />}
            <span className="text-xs text-muted">
              pagó {payer ? firstName(payer.name) : 'alguien'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            {everyone ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                entre todos · {money.primary(perPerson)} c/u
              </span>
            ) : (
              expense.participantIds.map((id) => {
                const member = byId.get(id);
                if (!member) return null;
                return (
                  <span
                    key={id}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ backgroundColor: `${member.color}22`, color: member.color }}
                    title={`${member.name}: ${money.primary(shares.get(id) ?? 0)}`}
                  >
                    {firstName(member.name)}
                  </span>
                );
              })
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-bold whitespace-nowrap text-money">
            {money.primary(expense.amountCents)}
          </p>
          {money.hasSecondary && (
            <p className="font-mono text-[11px] whitespace-nowrap text-muted">
              {money.secondary(expense.amountCents)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
