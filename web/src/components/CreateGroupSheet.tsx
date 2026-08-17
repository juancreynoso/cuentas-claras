/**
 * Formulario de creación de grupo.
 *
 * Reemplaza el array `PERSONAS` hardcodeado del original: quien crea el grupo
 * define los integrantes, la moneda y —si quiere— un PIN.
 */

import { useState } from 'react';
import { CURRENCIES } from '@shared/currencies';
import { LIMITS } from '@shared/types';
import { colorForIndex } from '@shared/colors';
import { ApiClientError, api } from '../lib/api';
import { Avatar, Button, ErrorBanner, Field, Input, Select, Sheet } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (code: string) => void;
}

/** Arranca con dos filas: un grupo de una sola persona no tiene sentido. */
const INITIAL_MEMBERS = ['', ''];

export function CreateGroupSheet({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [members, setMembers] = useState<string[]>(INITIAL_MEMBERS);
  const [showExtras, setShowExtras] = useState(false);
  const [secondaryCurrency, setSecondaryCurrency] = useState('');
  const [rate, setRate] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filledMembers = members.map((m) => m.trim()).filter(Boolean);

  // Duplicados sin distinguir mayúsculas: "Ana" y "ana" es un error de tipeo.
  const duplicates = new Set(
    filledMembers.filter(
      (m, i) =>
        filledMembers.findIndex((o) => o.toLocaleLowerCase() === m.toLocaleLowerCase()) !== i,
    ),
  );

  const rateNumber = Number(rate.replace(',', '.'));
  const rateValid = !secondaryCurrency || (Number.isFinite(rateNumber) && rateNumber > 0);
  const pinValid = pin === '' || (pin.length >= LIMITS.pin.min && pin.length <= LIMITS.pin.max);

  const canSubmit =
    name.trim().length > 0 &&
    filledMembers.length >= 2 &&
    duplicates.size === 0 &&
    rateValid &&
    pinValid &&
    !submitting;

  function updateMember(index: number, value: string) {
    setMembers((prev) => prev.map((m, i) => (i === index ? value : m)));
  }

  function addMemberRow() {
    setMembers((prev) => (prev.length >= LIMITS.membersPerGroup.max ? prev : [...prev, '']));
  }

  function removeMemberRow(index: number) {
    setMembers((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.createGroup({
        name: name.trim(),
        currency,
        secondaryCurrency: secondaryCurrency || null,
        secondaryRate: secondaryCurrency ? rateNumber : null,
        pin: pin || null,
        memberNames: filledMembers,
      });
      onCreated(result.group.code);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'No se pudo crear el grupo, probá de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} title="Nuevo grupo" onClose={onClose}>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <Field label="Nombre del viaje">
        {(id) => (
          <Input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Europa 2026"
            maxLength={LIMITS.groupName.max}
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Moneda principal" hint="En la que vas a cargar los gastos.">
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

      <fieldset className="mb-4">
        <legend className="mb-1.5 block text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          ¿Quiénes van?
        </legend>

        <div className="space-y-2">
          {members.map((member, index) => (
            <div key={index} className="flex items-center gap-2">
              <Avatar
                name={member.trim() || '?'}
                color={colorForIndex(index)}
                size="md"
                dimmed={!member.trim()}
              />
              <Input
                value={member}
                onChange={(e) => updateMember(index, e.target.value)}
                placeholder={`Integrante ${index + 1}`}
                maxLength={LIMITS.memberName.max}
                autoComplete="off"
                aria-label={`Nombre del integrante ${index + 1}`}
                className={duplicates.has(member.trim()) ? 'border-danger' : ''}
              />
              {members.length > 2 && (
                <button
                  onClick={() => removeMemberRow(index)}
                  className="shrink-0 px-2 text-muted transition-colors hover:text-danger"
                  aria-label={`Quitar integrante ${index + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {members.length < LIMITS.membersPerGroup.max && (
          <button
            onClick={addMemberRow}
            className="mt-2.5 text-[13px] font-semibold text-accent transition-opacity hover:opacity-80"
          >
            + Agregar integrante
          </button>
        )}

        {duplicates.size > 0 && (
          <p className="mt-2 text-xs text-danger" role="alert">
            Hay nombres repetidos: cada integrante necesita un nombre distinto.
          </p>
        )}
        {filledMembers.length < 2 && (
          <p className="mt-2 text-xs text-muted-dim">Completá al menos dos nombres.</p>
        )}
      </fieldset>

      {/* Lo opcional queda plegado para que el formulario no intimide. */}
      {!showExtras ? (
        <button
          onClick={() => setShowExtras(true)}
          className="mb-5 text-[13px] text-muted transition-colors hover:text-white"
        >
          + Opciones: segunda moneda y PIN
        </button>
      ) : (
        <div className="mb-5 rounded-xl border border-border-soft bg-surface/40 p-4">
          <Field
            label="Segunda moneda (opcional)"
            hint="Muestra cada monto también convertido, útil si el viaje es en otra moneda que la de tu bolsillo."
          >
            {(id) => (
              <Select
                id={id}
                value={secondaryCurrency}
                onChange={(e) => setSecondaryCurrency(e.target.value)}
              >
                <option value="">Ninguna</option>
                {CURRENCIES.filter((c) => c.code !== currency).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {secondaryCurrency && (
            <Field
              label={`Cotización: 1 ${currency} = ? ${secondaryCurrency}`}
              error={rateValid ? null : 'Ingresá un número mayor que cero.'}
            >
              {(id) => (
                <Input
                  id={id}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="1.16"
                  inputMode="decimal"
                  autoComplete="off"
                />
              )}
            </Field>
          )}

          <Field
            label="PIN (opcional)"
            hint="Sin PIN, cualquiera con el código puede ver y editar el grupo."
            error={pinValid ? null : `Entre ${LIMITS.pin.min} y ${LIMITS.pin.max} caracteres.`}
          >
            {(id) => (
              <Input
                id={id}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="····"
                maxLength={LIMITS.pin.max}
                autoComplete="new-password"
              />
            )}
          </Field>
        </div>
      )}

      <Button onClick={() => void submit()} disabled={!canSubmit} className="w-full">
        {submitting ? 'Creando...' : 'Crear grupo'}
      </Button>
    </Sheet>
  );
}
