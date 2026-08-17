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
        title="Todavía no hay gastos"
        description="Tocá el botón de abajo a la derecha para cargar el primero."
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
    <div className="space-y-6">
      {days.map((day) => {
        const dayTotal = day.items.reduce((sum, e) => sum + e.amountCents, 0);
        return (
          <section key={day.date}>
            <div className="mb-1.5 flex items-baseline justify-between px-0.5">
              <h3 className="text-[13px] font-medium text-ink-soft">
                {formatDateRelative(day.date)}
              </h3>
              <span className="font-mono text-[11px] text-muted">{money.compact(dayTotal)}</span>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {day.items.map((expense) => (
                <li key={expense.id}>
                  <ExpenseRow
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

function ExpenseRow({
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
      ? Math.floor(expense.amountCents / expense.participantIds.length)
      : 0;

  return (
    <button
      onClick={onEdit}
      className="animate-rise w-full bg-canvas px-3.5 py-3 text-left transition-colors hover:bg-surface"
      aria-label={`Editar gasto: ${expense.description}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base leading-none" aria-hidden="true">
          {category.icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{expense.description}</p>

          <div className="mt-1 flex items-center gap-1.5">
            {payer && <Avatar name={payer.name} color={payer.color} size="sm" />}
            <span className="text-xs text-muted">
              pagó {payer ? firstName(payer.name) : 'alguien'}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-muted">
            {everyone ? (
              <>entre todos · {money.primary(perPerson)} c/u</>
            ) : (
              <>
                entre{' '}
                {expense.participantIds
                  .map((id) => {
                    const member = byId.get(id);
                    return member ? firstName(member.name) : null;
                  })
                  .filter(Boolean)
                  .join(', ')}{' '}
                · {money.primary(shares.get(expense.participantIds[0] as string) ?? 0)} c/u
              </>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-[15px] font-bold whitespace-nowrap">
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
