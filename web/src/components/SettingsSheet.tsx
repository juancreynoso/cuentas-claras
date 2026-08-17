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
import { Avatar, Button, Field, IconButton, Input, Select, Sheet } from './ui';
import { IconCheck, IconClose, IconPencil, IconTrash } from './icons';

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

      <h3 className="mb-1.5 text-[13px] font-medium text-ink-soft">
        Integrantes ({members.length})
      </h3>

      <ul className="mb-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-2.5 bg-canvas px-3 py-2">
            <Avatar name={member.name} color={member.color} size="sm" />

            {editingMember === member.id ? (
              <>
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  maxLength={LIMITS.memberName.max}
                  autoFocus
                  aria-label={`Nuevo nombre para ${member.name}`}
                  className="py-1.5 text-[13px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void renameMember(member.id);
                    if (e.key === 'Escape') setEditingMember(null);
                  }}
                />
                <IconButton
                  label="Confirmar nombre"
                  onClick={() => void renameMember(member.id)}
                  className="h-8 w-8"
                >
                  <IconCheck size={16} />
                </IconButton>
                <IconButton
                  label="Cancelar"
                  onClick={() => setEditingMember(null)}
                  className="h-8 w-8"
                >
                  <IconClose size={16} />
                </IconButton>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px]">{member.name}</span>
                <IconButton
                  label={`Renombrar ${member.name}`}
                  onClick={() => {
                    setEditingMember(member.id);
                    setEditedName(member.name);
                  }}
                  className="h-8 w-8"
                >
                  <IconPencil size={15} />
                </IconButton>
                {members.length > 1 && (
                  <IconButton
                    label={`Eliminar ${member.name}`}
                    onClick={() => void onRemoveMember(member.id)}
                    className="h-8 w-8 hover:text-danger"
                  >
                    <IconTrash size={15} />
                  </IconButton>
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
            className="shrink-0"
          >
            Sumar
          </Button>
        </div>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        No se puede eliminar a alguien que pagó gastos: primero hay que editar o borrar esos gastos.
        Así los saldos nunca quedan descuadrados.
      </p>
    </>
  );
}
