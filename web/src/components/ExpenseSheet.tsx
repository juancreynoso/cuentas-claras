/**
 * Formulario de gasto, para crear o editar.
 *
 * El monto se tipea en decimal y se convierte a unidad menor entera antes de
 * salir del cliente: de acá para adentro del sistema no circulan floats.
 *
 * Estructura: `ExpenseSheet` es el panel, que se mantiene montado para poder
 * animar su entrada y salida; `ExpenseForm` guarda el estado y se remonta en
 * cada apertura vía `key`. Así los campos arrancan limpios sin necesidad de un
 * efecto que los resetee —que es el patrón que React recomienda evitar—.
 */

import { useState } from 'react';
import type { Expense, ExpenseInput, Group, Member } from '@shared/types';
import { LIMITS } from '@shared/types';
import { firstName } from '@shared/colors';
import { CATEGORIES, inferCategory, getCategory } from '@shared/categories';
import { minorToInputValue, parseMoneyToMinor } from '@shared/money';
import { splitCents } from '@shared/settlement';
import { currencySymbol } from '@shared/currencies';
import { todayISO } from '../lib/dates';
import { makeFormatter } from '../lib/display';
import { Avatar, Button, Field, Input, Select, Sheet } from './ui';

interface Props {
  open: boolean;
  /** null = nuevo gasto; un gasto = edición. */
  editing: Expense | null;
  /** Cambia en cada apertura y fuerza que el formulario se remonte limpio. */
  session: number;
  group: Group;
  members: Member[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: ExpenseInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function ExpenseSheet({ open, editing, session, ...rest }: Props) {
  return (
    <Sheet open={open} title={editing ? 'Editar gasto' : 'Nuevo gasto'} onClose={rest.onClose}>
      <ExpenseForm key={session} editing={editing} {...rest} />
    </Sheet>
  );
}

type FormProps = Omit<Props, 'open' | 'session'>;

function ExpenseForm({ editing, group, members, saving, onClose, onSave, onDelete }: FormProps) {
  // El estado se inicializa una sola vez, desde las props, porque el
  // componente se remonta cada vez que se abre el panel.
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(() =>
    editing ? minorToInputValue(editing.amountCents, group.currency) : '',
  );
  const [spentOn, setSpentOn] = useState(() => editing?.spentOn ?? todayISO());
  const [payerId, setPayerId] = useState(() => editing?.payerId ?? members[0]?.id ?? '');
  const [participants, setParticipants] = useState<Set<string>>(
    () => new Set(editing?.participantIds ?? members.map((m) => m.id)),
  );
  const [category, setCategory] = useState(editing?.category ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const money = makeFormatter(group);

  const amountCents = parseMoneyToMinor(amount, group.currency);
  const participantIds = [...participants];

  const amountInvalid = amount.trim() !== '' && (amountCents === null || amountCents <= 0);
  const canSubmit =
    description.trim().length > 0 &&
    amountCents !== null &&
    amountCents >= LIMITS.amountCents.min &&
    amountCents <= LIMITS.amountCents.max &&
    participantIds.length > 0 &&
    payerId !== '' &&
    spentOn !== '' &&
    !saving;

  function toggleParticipant(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setParticipants((prev) =>
      prev.size === members.length ? new Set() : new Set(members.map((m) => m.id)),
    );
  }

  async function submit() {
    if (!canSubmit || amountCents === null) return;
    const ok = await onSave({
      description: description.trim(),
      amountCents,
      spentOn,
      payerId,
      participantIds,
      category: category || null,
    });
    if (ok) onClose();
  }

  async function remove() {
    if (!editing) return;
    if (await onDelete(editing.id)) onClose();
  }

  // Vista previa del reparto exacto, incluido el centavo del resto.
  const shares = amountCents !== null ? splitCents(amountCents, participantIds) : null;
  const inferred = description.trim() ? getCategory(inferCategory(description)) : null;

  return (
    <>
      <Field label="Descripción">
        {(id) => (
          <Input
            id={id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Cena en el centro"
            maxLength={LIMITS.description.max}
            autoComplete="off"
          />
        )}
      </Field>

      <div className="flex gap-3">
        <div className="flex-1">
          <Field
            label={`Monto (${currencySymbol(group.currency)})`}
            error={amountInvalid ? 'Ingresá un monto válido.' : null}
          >
            {(id) => (
              <Input
                id={id}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                autoComplete="off"
                className={amountInvalid ? 'border-danger' : ''}
              />
            )}
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Fecha">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
                max="2100-12-31"
              />
            )}
          </Field>
        </div>
      </div>

      <Field label="¿Quién pagó?">
        {(id) => (
          <Select id={id} value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {/* El <legend> tiene que ser el primer hijo del <fieldset> para ser su
          título accesible; el botón va posicionado, no envuelto junto a él. */}
      <fieldset className="relative mb-4">
        <legend className="mb-1.5 block text-[13px] font-medium text-ink-soft">
          ¿Entre quiénes se divide?
        </legend>
        <button
          onClick={toggleAll}
          className="absolute top-0 right-0 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          {participants.size === members.length ? 'Ninguno' : 'Todos'}
        </button>

        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {members.map((member) => {
            const selected = participants.has(member.id);
            const share = shares?.get(member.id);
            return (
              <li key={member.id}>
                <button
                  onClick={() => toggleParticipant(member.id)}
                  className="flex w-full items-center gap-2.5 bg-canvas px-3 py-2.5 text-left transition-colors hover:bg-surface"
                  aria-pressed={selected}
                  aria-label={`${member.name}${selected ? ' (incluido)' : ' (excluido)'}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      selected ? 'border-ink bg-ink' : 'border-border-strong bg-canvas'
                    }`}
                    aria-hidden="true"
                  >
                    {selected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <Avatar name={member.name} color={member.color} size="sm" dimmed={!selected} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${selected ? 'font-medium' : 'text-muted'}`}
                  >
                    {firstName(member.name)}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] text-muted">
                    {selected && share !== undefined ? money.primary(share) : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-1.5 min-h-4 text-[12px] text-muted">
          {participantIds.length === 0
            ? 'Elegí al menos una persona.'
            : amountCents !== null && amountCents > 0
              ? `${money.primary(Math.floor(amountCents / participantIds.length))} por persona · ${participantIds.length} ${participantIds.length === 1 ? 'persona' : 'personas'}`
              : ''}
        </p>
      </fieldset>

      <Field
        label="Categoría"
        hint={
          category === '' && inferred
            ? `Detectada automáticamente: ${inferred.icon} ${inferred.name}`
            : undefined
        }
      >
        {(id) => (
          <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Detectar automáticamente</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="mt-5 flex gap-2.5">
        {editing &&
          (confirmingDelete ? (
            <>
              <Button
                variant="danger"
                onClick={() => void remove()}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Borrando...' : 'Confirmar borrado'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                No
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Eliminar
            </Button>
          ))}

        {!confirmingDelete && (
          <Button onClick={() => void submit()} disabled={!canSubmit} className="flex-1">
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar gasto'}
          </Button>
        )}
      </div>
    </>
  );
}
