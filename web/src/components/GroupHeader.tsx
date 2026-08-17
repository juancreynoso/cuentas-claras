/**
 * Cabecera del grupo: nombre, total gastado y cuánto puso cada integrante.
 */

import type { Group, Member } from '@shared/types';
import { firstName } from '@shared/colors';
import type { MoneyFormatter } from '../lib/display';
import { Avatar } from './ui';

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
    <header className="bg-gradient-to-b from-ink-raised to-ink px-5 pt-12 pb-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={onShare}
            className="mb-1 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.2em] text-muted transition-colors hover:text-accent"
            aria-label="Compartir el código del grupo"
          >
            {group.code}
            <span aria-hidden="true" className="text-[10px]">
              🔗
            </span>
          </button>
          <h1 className="truncate text-2xl leading-tight font-bold">{group.name}</h1>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] text-muted">Total gastado</p>
          <p className="font-mono text-xl font-bold text-money">{money.primary(totalCents)}</p>
          {money.hasSecondary && (
            <p className="font-mono text-xs text-muted">{money.secondary(totalCents)}</p>
          )}
          <p className="mt-0.5 min-h-4 text-[10px] text-accent" aria-live="polite">
            {saving ? 'guardando...' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <ul className="flex flex-wrap gap-3">
          {members.map((member) => {
            const paid = paidByMember.get(member.id) ?? 0;
            return (
              <li key={member.id} className="flex w-12 flex-col items-center gap-1">
                <Avatar name={member.name} color={member.color} size="lg" ring={paid > 0} />
                <span className="w-full truncate text-center text-[10px] text-muted">
                  {firstName(member.name)}
                </span>
                <span
                  className="font-mono text-[10px] leading-tight"
                  style={{ color: paid > 0 ? member.color : 'transparent' }}
                >
                  {paid > 0 ? money.compact(paid) : '·'}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-1 flex shrink-0 flex-col gap-2">
          {/* Varias personas cargan gastos a la vez: hace falta poder traer
              lo que agregaron los demás sin recargar la página. */}
          <button
            onClick={onRefresh}
            disabled={saving}
            className="text-base text-muted transition-colors hover:text-white disabled:opacity-40"
            aria-label="Actualizar los gastos del grupo"
          >
            <span className={saving ? 'inline-block animate-spin' : 'inline-block'}>🔄</span>
          </button>
          <button
            onClick={onSettings}
            className="text-lg text-muted transition-colors hover:text-white"
            aria-label="Ajustes del grupo"
          >
            ⚙️
          </button>
        </div>
      </div>
    </header>
  );
}
