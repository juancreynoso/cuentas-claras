/**
 * Quién le debe a quién.
 *
 * Muestra dos cosas distintas y complementarias: el saldo neto de cada persona
 * (cuánto puso vs. cuánto le tocaba) y la lista concreta de transferencias que
 * salda todo. La segunda es la que se ejecuta; la primera explica por qué.
 */

import type { Balance, Transfer } from '@shared/settlement';
import type { Member } from '@shared/types';
import { firstName } from '@shared/colors';
import type { MoneyFormatter } from '../lib/display';
import { Avatar, EmptyState } from './ui';

interface Props {
  balances: Balance[];
  transfers: Transfer[];
  members: Member[];
  money: MoneyFormatter;
  hasExpenses: boolean;
}

export function BalancesTab({ balances, transfers, members, money, hasExpenses }: Props) {
  const byId = new Map(members.map((m) => [m.id, m]));

  if (!hasExpenses) {
    return (
      <EmptyState
        icon="🤝"
        title="Sin gastos que saldar"
        description="Cargá algunos gastos y acá va a aparecer quién le debe a quién."
      />
    );
  }

  if (transfers.length === 0) {
    return (
      <EmptyState
        icon="🎉"
        title="¡El grupo está al día!"
        description="Nadie le debe nada a nadie."
      />
    );
  }

  return (
    <div>
      <p className="mb-4 text-center text-xs text-muted-dim">
        {transfers.length} {transfers.length === 1 ? 'transferencia' : 'transferencias'} para saldar
        todo
      </p>

      <ul className="mb-8 space-y-2">
        {transfers.map((transfer, index) => {
          const from = byId.get(transfer.fromId);
          const to = byId.get(transfer.toId);
          if (!from || !to) return null;

          return (
            <li
              key={`${transfer.fromId}-${transfer.toId}-${index}`}
              className="animate-rise flex items-center gap-3 rounded-card border border-border bg-surface p-4"
            >
              <Avatar name={from.name} color={from.color} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  <strong style={{ color: from.color }}>{firstName(from.name)}</strong> le paga a{' '}
                  <strong style={{ color: to.color }}>{firstName(to.name)}</strong>
                </p>
                <p className="font-mono text-lg font-bold text-danger">
                  {money.primary(transfer.amountCents)}
                </p>
                {money.hasSecondary && (
                  <p className="font-mono text-[11px] text-muted">
                    {money.secondary(transfer.amountCents)}
                  </p>
                )}
              </div>
              <Avatar name={to.name} color={to.color} size="lg" />
            </li>
          );
        })}
      </ul>

      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
        Saldo de cada uno
      </h3>
      <ul className="space-y-1.5">
        {[...balances]
          .sort((a, b) => b.netCents - a.netCents)
          .map((balance) => {
            const member = byId.get(balance.memberId);
            if (!member) return null;

            const net = balance.netCents;
            const label = net > 0 ? 'le deben' : net < 0 ? 'debe' : 'al día';
            const color = net > 0 ? 'text-money' : net < 0 ? 'text-danger' : 'text-muted';

            return (
              <li
                key={balance.memberId}
                className="flex items-center gap-3 rounded-xl bg-surface/50 px-3 py-2.5"
              >
                <Avatar name={member.name} color={member.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{member.name}</span>
                <span className="text-right">
                  <span className="mr-2 text-[11px] text-muted">{label}</span>
                  <span className={`font-mono text-[13px] font-bold ${color}`}>
                    {money.primary(Math.abs(net))}
                  </span>
                </span>
              </li>
            );
          })}
      </ul>

      <p className="mt-5 px-2 text-center text-[11px] leading-relaxed text-muted-dim">
        El saldo es lo que cada uno puso menos lo que le tocaba pagar según su participación en cada
        gasto.
      </p>
    </div>
  );
}
