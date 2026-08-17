/**
 * Ajustes del grupo: datos generales e integrantes.
 *
 * Todo lo que en la versión original era una constante en el código —nombres,
 * moneda, cotización— se edita acá.
 *
 * Mismo patrón que `ExpenseSheet`: el panel se mantiene montado para animar y
 * el formulario se remonta por `key` en cada apertura, así arranca reflejando
 * el estado real del grupo sin un efecto que lo sincronice.
 */

import { useState } from 'react';
import type { Group, Member, UpdateGroupInput } from '@shared/types';
import { LIMITS } from '@shared/types';
import { CURRENCIES } from '@shared/currencies';
import { Avatar, Button, Field, Input, Select, Sheet } from './ui';

interface Props {
  open: boolean;
  /** Cambia en cada apertura y fuerza que el formulario se remonte. */
  session: number;
  group: Group;
  members: Member[];
  saving: boolean;
  onClose: () => void;
  onUpdateGroup: (patch: UpdateGroupInput) => Promise<boolean>;
  onAddMember: (name: string) => Promise<boolean>;
  onRenameMember: (id: string, name: string) => Promise<boolean>;
  onRemoveMember: (id: string) => Promise<boolean>;
}

export function SettingsSheet({ open, session, ...rest }: Props) {
  return (
    <Sheet open={open} title="Ajustes del grupo" onClose={rest.onClose}>
      <SettingsForm key={session} {...rest} />
    </Sheet>
  );
}

type FormProps = Omit<Props, 'open' | 'session'>;

function SettingsForm({
  group,
  members,
  saving,
  onUpdateGroup,
  onAddMember,
  onRenameMember,
  onRemoveMember,
}: FormProps) {
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.currency);
  const [secondary, setSecondary] = useState(group.secondaryCurrency ?? '');
  const [rate, setRate] = useState(group.secondaryRate ? String(group.secondaryRate) : '');
  const [newMember, setNewMember] = useState('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');

  const rateNumber = Number(rate.replace(',', '.'));
  const rateValid = !secondary || (Number.isFinite(rateNumber) && rateNumber > 0);

  const dirty =
    name.trim() !== group.name ||
    currency !== group.currency ||
    (secondary || null) !== group.secondaryCurrency ||
    (secondary ? rateNumber : null) !== group.secondaryRate;

  const canSave = dirty && name.trim().length > 0 && rateValid && !saving;

  async function saveGeneral() {
    if (!canSave) return;
    await onUpdateGroup({
      name: name.trim(),
      currency,
      secondaryCurrency: secondary || null,
      secondaryRate: secondary ? rateNumber : null,
    });
  }

  async function addMember() {
    const trimmed = newMember.trim();
    if (!trimmed) return;
    if (await onAddMember(trimmed)) setNewMember('');
  }

  async function renameMember(id: string) {
    const trimmed = editedName.trim();
    if (!trimmed) return;
    if (await onRenameMember(id, trimmed)) setEditingMember(null);
  }

  return (
    <>
      <Field label="Nombre del viaje">
        {(id) => (
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LIMITS.groupName.max}
          />
        )}
      </Field>

      <Field
        label="Moneda principal"
        hint="Cambiarla no reconvierte los montos ya cargados: sólo cambia el símbolo."
      >
        {(id) => (
          <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Segunda moneda">
        {(id) => (
          <Select id={id} value={secondary} onChange={(e) => setSecondary(e.target.value)}>
            <option value="">Ninguna</option>
            {CURRENCIES.filter((c) => c.code !== currency).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {secondary && (
        <Field
          label={`Cotización: 1 ${currency} = ? ${secondary}`}
          error={rateValid ? null : 'Ingresá un número mayor que cero.'}
        >
          {(id) => (
            <Input
              id={id}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="1.16"
              inputMode="decimal"
            />
          )}
        </Field>
      )}

      <Button onClick={() => void saveGeneral()} disabled={!canSave} className="mb-8 w-full">
        {saving ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Sin cambios'}
      </Button>

      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
        Integrantes ({members.length})
      </h3>

      <ul className="mb-3 space-y-2">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-2.5">
            <Avatar name={member.name} color={member.color} size="md" />

            {editingMember === member.id ? (
              <>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  maxLength={LIMITS.memberName.max}
                  autoFocus
                  aria-label={`Nuevo nombre para ${member.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void renameMember(member.id);
                    if (e.key === 'Escape') setEditingMember(null);
                  }}
                />
                <button
                  onClick={() => void renameMember(member.id)}
                  className="shrink-0 px-1.5 text-money"
                  aria-label="Confirmar nombre"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingMember(null)}
                  className="shrink-0 px-1.5 text-muted"
                  aria-label="Cancelar"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                <button
                  onClick={() => {
                    setEditingMember(member.id);
                    setEditedName(member.name);
                  }}
                  className="shrink-0 px-1.5 text-xs text-muted transition-colors hover:text-white"
                  aria-label={`Renombrar ${member.name}`}
                >
                  ✏️
                </button>
                {members.length > 1 && (
                  <button
                    onClick={() => void onRemoveMember(member.id)}
                    className="shrink-0 px-1.5 text-xs text-muted transition-colors hover:text-danger"
                    aria-label={`Eliminar ${member.name}`}
                  >
                    🗑️
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {members.length < LIMITS.membersPerGroup.max && (
        <div className="flex gap-2">
          <Input
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder="Sumar integrante"
            maxLength={LIMITS.memberName.max}
            aria-label="Nombre del nuevo integrante"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addMember();
            }}
          />
          <Button
            variant="ghost"
            onClick={() => void addMember()}
            disabled={!newMember.trim() || saving}
            className="shrink-0 px-4"
          >
            Sumar
          </Button>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-dim">
        No se puede eliminar a alguien que pagó gastos: primero hay que editar o borrar esos gastos.
        Así los saldos nunca quedan descuadrados.
      </p>
    </>
  );
}
