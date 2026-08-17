/**
 * Quién le debe a quién.
 *
 * Muestra dos cosas distintas y complementarias: la lista concreta de
 * transferencias que salda todo, y el saldo neto de cada persona. La primera
 * es la que se ejecuta; la segunda explica por qué.
 */

import type { Balance, Transfer } from '@shared/settlement';
import type { Member } from '@shared/types';
import { firstName } from '@shared/colors';
import type { MoneyFormatter } from '../lib/display';
import { Avatar, EmptyState } from './ui';
import { IconArrowRight } from './icons';

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
        title="Sin gastos que saldar"
        description="Cargá algunos gastos y acá va a aparecer quién le debe a quién."
      />
    );
  }

  if (transfers.length === 0) {
    return <EmptyState title="El grupo está al día" description="Nadie le debe nada a nadie." />;
  }

  return (
    <div>
      <h3 className="mb-1.5 px-0.5 text-[13px] font-medium text-ink-soft">
        {transfers.length} {transfers.length === 1 ? 'transferencia' : 'transferencias'} para saldar
        todo
      </h3>

      <ul className="mb-8 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {transfers.map((transfer, index) => {
          const from = byId.get(transfer.fromId);
          const to = byId.get(transfer.toId);
          if (!from || !to) return null;

          return (
            <li
              key={`${transfer.fromId}-${transfer.toId}-${index}`}
              className="animate-rise flex items-center gap-3 bg-canvas px-3.5 py-3.5"
            >
              <Avatar name={from.name} color={from.color} size="md" />
              <IconArrowRight size={16} className="shrink-0 text-faint" />
              <Avatar name={to.name} color={to.color} size="md" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">
                  <span className="font-medium">{firstName(from.name)}</span>
                  <span className="text-muted"> le paga a </span>
                  <span className="font-medium">{firstName(to.name)}</span>
                </p>
                {money.hasSecondary && (
                  <p className="font-mono text-[11px] text-muted">
                    {money.secondary(transfer.amountCents)}
                  </p>
                )}
              </div>

              <span className="shrink-0 font-mono text-[15px] font-bold whitespace-nowrap">
                {money.primary(transfer.amountCents)}
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="mb-1.5 px-0.5 text-[13px] font-medium text-ink-soft">Saldo de cada uno</h3>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {[...balances]
          .sort((a, b) => b.netCents - a.netCents)
          .map((balance) => {
            const member = byId.get(balance.memberId);
            if (!member) return null;

            const net = balance.netCents;
            // El color no es el único portador: la etiqueta dice qué pasa.
            const label = net > 0 ? 'le deben' : net < 0 ? 'debe' : 'al día';

            return (
              <li
                key={balance.memberId}
                className="flex items-center gap-2.5 bg-canvas px-3.5 py-3"
              >
                <Avatar name={member.name} color={member.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {member.name}
                </span>
                <span className="text-xs text-muted">{label}</span>
                <span
                  className={`w-24 text-right font-mono text-[13px] font-bold ${
                    net < 0 ? 'text-danger' : net > 0 ? 'text-ink' : 'text-faint'
                  }`}
                >
                  {net === 0 ? '—' : money.primary(Math.abs(net))}
                </span>
              </li>
            );
          })}
      </ul>

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-muted">
        El saldo es lo que cada uno puso menos lo que le tocaba pagar según su participación en cada
        gasto.
      </p>
    </div>
  );
}
