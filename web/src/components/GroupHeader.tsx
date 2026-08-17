/**
 * Cabecera del grupo: nombre, total gastado y cuánto puso cada integrante.
 */

import type { Group, Member } from '@shared/types';
import { firstName } from '@shared/colors';
import type { MoneyFormatter } from '../lib/display';
import { Avatar, IconButton } from './ui';
import { IconRefresh, IconSettings, IconShare } from './icons';

interface Props {
  group: Group;
  members: Member[];
  /** Cuánto puso de su bolsillo cada integrante, por id. */
  paidByMember: Map<string, number>;
  totalCents: number;
  money: MoneyFormatter;
  saving: boolean;
  onShare: () => void;
  onSettings: () => void;
  onRefresh: () => void;
}

export function GroupHeader({
  group,
  members,
  paidByMember,
  totalCents,
  money,
  saving,
  onShare,
  onSettings,
  onRefresh,
}: Props) {
  return (
    <header className="border-b border-border px-4 pt-6 pb-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{group.name}</h1>
          <button
            onClick={onShare}
            className="mt-0.5 font-mono text-xs tracking-[0.15em] text-muted transition-colors hover:text-ink"
          >
            {group.code}
          </button>
        </div>

        <div className="-mr-1.5 flex shrink-0 items-center">
          <IconButton label="Compartir el grupo" onClick={onShare}>
            <IconShare />
          </IconButton>
          {/* Varias personas cargan gastos a la vez: hace falta poder traer
              lo que agregaron los demás sin recargar la página. */}
          <IconButton label="Actualizar los gastos" onClick={onRefresh} disabled={saving}>
            <IconRefresh className={saving ? 'animate-spin' : ''} />
          </IconButton>
          <IconButton label="Ajustes del grupo" onClick={onSettings}>
            <IconSettings />
          </IconButton>
        </div>
      </div>

      <div className="mb-5 flex items-baseline gap-2.5">
        <span className="font-mono text-3xl font-bold tracking-tight">
          {money.primary(totalCents)}
        </span>
        {money.hasSecondary && (
          <span className="font-mono text-sm text-muted">{money.secondary(totalCents)}</span>
        )}
        <span className="ml-auto text-xs text-muted" aria-live="polite">
          {saving ? 'guardando…' : 'total gastado'}
        </span>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-3">
        {members.map((member) => {
          const paid = paidByMember.get(member.id) ?? 0;
          return (
            <li key={member.id} className="flex items-center gap-2">
              <Avatar name={member.name} color={member.color} size="md" dimmed={paid === 0} />
              <span className="leading-tight">
                <span className="block text-[13px] font-medium">{firstName(member.name)}</span>
                <span className="block font-mono text-[11px] text-muted">
                  {paid > 0 ? money.compact(paid) : '—'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
