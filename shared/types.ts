/**
 * Contrato compartido entre el Worker y el cliente.
 *
 * Vive fuera de `web/` y `api/` para que el tipo de cada payload se defina una
 * sola vez: si cambia la API, el frontend deja de compilar.
 *
 * Convención de dinero: TODO monto viaja y se guarda como centavos enteros
 * (`amountCents`). La conversión a decimal ocurre sólo al formatear para el
 * usuario y al parsear lo que escribe.
 */

export interface Member {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  /** ISO 'YYYY-MM-DD' */
  spentOn: string;
  payerId: string;
  /** Categoría fijada a mano; `null` = inferirla de la descripción. */
  category: string | null;
  participantIds: string[];
  createdAt: number;
}

export interface Group {
  code: string;
  name: string;
  currency: string;
  secondaryCurrency: string | null;
  secondaryRate: number | null;
  hasPin: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Respuesta de GET /api/groups/:code — un solo round-trip para todo el estado. */
export interface GroupSnapshot {
  group: Group;
  members: Member[];
  expenses: Expense[];
}

export interface SessionResponse {
  token: string;
  group: Group;
}

// ── Payloads de escritura ────────────────────────────────────────────────────

export interface CreateGroupInput {
  name: string;
  currency: string;
  secondaryCurrency?: string | null;
  secondaryRate?: number | null;
  pin?: string | null;
  memberNames: string[];
}

export interface UpdateGroupInput {
  name?: string;
  currency?: string;
  secondaryCurrency?: string | null;
  secondaryRate?: number | null;
}

export interface ExpenseInput {
  description: string;
  amountCents: number;
  spentOn: string;
  payerId: string;
  participantIds: string[];
  category?: string | null;
}

export interface MemberInput {
  name: string;
}

export interface ApiErrorBody {
  error: string;
  code: string;
}

// ── Límites, compartidos para validar igual en cliente y servidor ────────────

export const LIMITS = {
  groupName: { min: 1, max: 60 },
  memberName: { min: 1, max: 30 },
  description: { min: 1, max: 120 },
  membersPerGroup: { min: 1, max: 20 },
  expensesPerGroup: 2000,
  /** 10 millones en unidades de la moneda; corta montos absurdos. */
  amountCents: { min: 1, max: 1_000_000_000 },
  pin: { min: 4, max: 12 },
} as const;
