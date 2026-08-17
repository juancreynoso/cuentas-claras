/**
 * Validación de todo lo que entra por la API.
 *
 * Regla: el servidor no confía en nada del cliente. Cada campo se valida en
 * tipo, rango y longitud antes de tocar la base. Los límites viven en
 * `@shared/types` para que cliente y servidor apliquen exactamente los mismos.
 */

import { LIMITS } from '@shared/types';
import type { CreateGroupInput, ExpenseInput, MemberInput, UpdateGroupInput } from '@shared/types';
import { isValidCurrency } from '@shared/currencies';
import { CATEGORY_IDS } from '@shared/categories';
import { badRequest } from './http';

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest('Se esperaba un objeto JSON');
  }
  return value as Record<string, unknown>;
}

function str(value: unknown, field: string, { min, max }: { min: number; max: number }): string {
  if (typeof value !== 'string') throw badRequest(`"${field}" debe ser texto`);
  // Normalizamos a NFC para que "José" tipeado de dos formas distintas
  // (é precompuesta vs e + tilde) se guarde igual y no duplique integrantes.
  const trimmed = value.trim().normalize('NFC');
  if (trimmed.length < min) throw badRequest(`"${field}" no puede estar vacío`);
  if (trimmed.length > max) {
    throw badRequest(`"${field}" no puede tener más de ${max} caracteres`);
  }
  // Los caracteres de control rompen el render y no aportan nada.
  if (/[\p{Cc}\p{Cf}]/u.test(trimmed)) {
    throw badRequest(`"${field}" contiene caracteres no permitidos`);
  }
  return trimmed;
}

function int(value: unknown, field: string, { min, max }: { min: number; max: number }): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest(`"${field}" debe ser un número entero`);
  }
  if (value < min || value > max) {
    throw badRequest(`"${field}" está fuera del rango permitido`);
  }
  return value;
}

/** Valida una fecha ISO 'YYYY-MM-DD' que además exista en el calendario. */
function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`"${field}" debe tener formato YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) {
    throw badRequest(`"${field}" no es una fecha válida`);
  }
  const year = Number(value.slice(0, 4));
  if (year < 2000 || year > 2100) throw badRequest(`"${field}" está fuera de rango`);
  return value;
}

function currency(value: unknown, field: string): string {
  if (!isValidCurrency(value)) throw badRequest(`"${field}" no es una moneda soportada`);
  return value;
}

function optionalRate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000) {
    throw badRequest('La cotización debe ser un número positivo');
  }
  // Seis decimales alcanzan para cualquier par de monedas y evitan que se
  // guarde basura como 1.1600000000000001.
  return Math.round(value * 1e6) / 1e6;
}

function uniqueIds(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest(`"${field}" debe tener al menos un elemento`);
  }
  if (value.length > LIMITS.membersPerGroup.max) {
    throw badRequest(`"${field}" tiene demasiados elementos`);
  }
  const ids = value.map((v) => {
    if (typeof v !== 'string' || v.length === 0 || v.length > 64) {
      throw badRequest(`"${field}" contiene un id inválido`);
    }
    return v;
  });
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) throw badRequest(`"${field}" tiene elementos repetidos`);
  return unique;
}

function optionalCategory(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !CATEGORY_IDS.includes(value)) {
    throw badRequest('Categoría inválida');
  }
  return value;
}

export function validatePin(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw badRequest('El PIN debe ser texto');
  const pin = value.trim();
  if (pin.length < LIMITS.pin.min || pin.length > LIMITS.pin.max) {
    throw badRequest(
      `El PIN debe tener entre ${LIMITS.pin.min} y ${LIMITS.pin.max} caracteres`,
      'invalid_pin',
    );
  }
  return pin;
}

// ── Validadores de payload ───────────────────────────────────────────────────

export function validateCreateGroup(body: unknown): CreateGroupInput {
  const raw = asObject(body);

  const names = raw.memberNames;
  if (!Array.isArray(names)) throw badRequest('"memberNames" debe ser una lista');
  if (names.length < LIMITS.membersPerGroup.min) {
    throw badRequest('Agregá al menos un integrante');
  }
  if (names.length > LIMITS.membersPerGroup.max) {
    throw badRequest(`Un grupo admite hasta ${LIMITS.membersPerGroup.max} integrantes`);
  }

  const memberNames = names.map((n, i) => str(n, `memberNames[${i}]`, LIMITS.memberName));

  // Comparación case-insensitive: "Ana" y "ana" en el mismo grupo es un error
  // de tipeo, no dos personas, y confundiría al elegir quién pagó.
  const seen = new Set<string>();
  for (const name of memberNames) {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) throw badRequest(`El integrante "${name}" está repetido`);
    seen.add(key);
  }

  const secondaryCurrency =
    raw.secondaryCurrency === null ||
    raw.secondaryCurrency === undefined ||
    raw.secondaryCurrency === ''
      ? null
      : currency(raw.secondaryCurrency, 'secondaryCurrency');
  const secondaryRate = optionalRate(raw.secondaryRate);

  if (secondaryCurrency && secondaryRate === null) {
    throw badRequest('Si elegís una moneda secundaria, indicá su cotización');
  }

  return {
    name: str(raw.name, 'name', LIMITS.groupName),
    currency: currency(raw.currency ?? 'EUR', 'currency'),
    secondaryCurrency,
    secondaryRate: secondaryCurrency ? secondaryRate : null,
    pin: validatePin(raw.pin),
    memberNames,
  };
}

export function validateUpdateGroup(body: unknown): UpdateGroupInput {
  const raw = asObject(body);
  const out: UpdateGroupInput = {};

  if (raw.name !== undefined) out.name = str(raw.name, 'name', LIMITS.groupName);
  if (raw.currency !== undefined) out.currency = currency(raw.currency, 'currency');

  if (raw.secondaryCurrency !== undefined) {
    out.secondaryCurrency =
      raw.secondaryCurrency === null || raw.secondaryCurrency === ''
        ? null
        : currency(raw.secondaryCurrency, 'secondaryCurrency');
  }
  if (raw.secondaryRate !== undefined) out.secondaryRate = optionalRate(raw.secondaryRate);

  if (out.secondaryCurrency === null) out.secondaryRate = null;

  if (Object.keys(out).length === 0) throw badRequest('No hay nada que actualizar');
  return out;
}

export function validateExpense(body: unknown): ExpenseInput {
  const raw = asObject(body);
  return {
    description: str(raw.description, 'description', LIMITS.description),
    amountCents: int(raw.amountCents, 'amountCents', LIMITS.amountCents),
    spentOn: isoDate(raw.spentOn, 'spentOn'),
    payerId: str(raw.payerId, 'payerId', { min: 1, max: 64 }),
    participantIds: uniqueIds(raw.participantIds, 'participantIds'),
    category: optionalCategory(raw.category),
  };
}

export function validateMember(body: unknown): MemberInput {
  const raw = asObject(body);
  return { name: str(raw.name, 'name', LIMITS.memberName) };
}

/** El código de grupo llega por URL: normalizamos a mayúsculas y validamos forma. */
export function validateGroupCode(value: string | undefined): string {
  if (!value) throw badRequest('Falta el código de grupo', 'missing_code');
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    throw badRequest('Código de grupo inválido', 'invalid_code');
  }
  return code;
}
