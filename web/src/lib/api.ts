/**
 * Cliente HTTP de la API.
 *
 * Envuelve fetch para que el resto de la app no toque URLs, headers ni el
 * formato de error. Todo fallo llega como `ApiClientError`, con el `code`
 * que manda el servidor: así la UI puede distinguir "PIN requerido" de
 * "grupo inexistente" sin parsear mensajes.
 */

import type {
  CreateGroupInput,
  ExpenseInput,
  GroupSnapshot,
  Member,
  SessionResponse,
  UpdateGroupInput,
  ApiErrorBody,
} from '@shared/types';
import { getToken, setToken } from './session';

const BASE = '/api';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** El token no sirve más: hay que volver a pedir el PIN. */
  get needsReauth(): boolean {
    return (
      this.status === 401 ||
      this.code === 'session_expired' ||
      this.code === 'missing_session' ||
      this.code === 'invalid_session'
    );
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Código de grupo cuyo token hay que enviar. */
  code?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, code } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (code) {
    const token = getToken(code);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Sin red, o el Worker no responde.
    throw new ApiClientError(0, 'No se pudo conectar. Revisá tu conexión.', 'network_error');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const err = payload as ApiErrorBody | null;
    throw new ApiClientError(
      response.status,
      err?.error ?? 'Algo salió mal, probá de nuevo.',
      err?.code ?? 'unknown',
    );
  }

  return payload as T;
}

type SessionPayload = SessionResponse & { snapshot: GroupSnapshot };

export const api = {
  /** Crea un grupo. Devuelve el snapshot inicial, así no hace falta un GET extra. */
  async createGroup(input: CreateGroupInput): Promise<SessionPayload> {
    const result = await request<SessionPayload>('/groups', { method: 'POST', body: input });
    setToken(result.group.code, result.token);
    return result;
  },

  /**
   * Canjea el código (y el PIN si el grupo lo tiene) por un token de sesión.
   * Lanza `pin_required` con status 403 si falta el PIN.
   */
  async openSession(code: string, pin?: string): Promise<SessionPayload> {
    const result = await request<SessionPayload>(`/groups/${encodeURIComponent(code)}/session`, {
      method: 'POST',
      body: pin ? { pin } : {},
    });
    setToken(code, result.token);
    return result;
  },

  getSnapshot(code: string): Promise<GroupSnapshot> {
    return request<GroupSnapshot>(`/groups/${encodeURIComponent(code)}`, { code });
  },

  updateGroup(code: string, patch: UpdateGroupInput): Promise<GroupSnapshot> {
    return request<GroupSnapshot>(`/groups/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      body: patch,
      code,
    });
  },

  deleteGroup(code: string): Promise<{ ok: true }> {
    return request(`/groups/${encodeURIComponent(code)}`, { method: 'DELETE', code });
  },

  addMember(code: string, name: string): Promise<{ member: Member }> {
    return request(`/groups/${encodeURIComponent(code)}/members`, {
      method: 'POST',
      body: { name },
      code,
    });
  },

  renameMember(code: string, memberId: string, name: string): Promise<{ ok: true }> {
    return request(`/groups/${encodeURIComponent(code)}/members/${encodeURIComponent(memberId)}`, {
      method: 'PATCH',
      body: { name },
      code,
    });
  },

  deleteMember(code: string, memberId: string): Promise<{ ok: true }> {
    return request(`/groups/${encodeURIComponent(code)}/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      code,
    });
  },

  createExpense(code: string, input: ExpenseInput): Promise<{ id: string }> {
    return request(`/groups/${encodeURIComponent(code)}/expenses`, {
      method: 'POST',
      body: input,
      code,
    });
  },

  updateExpense(code: string, expenseId: string, input: ExpenseInput): Promise<{ ok: true }> {
    return request(
      `/groups/${encodeURIComponent(code)}/expenses/${encodeURIComponent(expenseId)}`,
      {
        method: 'PATCH',
        body: input,
        code,
      },
    );
  },

  deleteExpense(code: string, expenseId: string): Promise<{ ok: true }> {
    return request(
      `/groups/${encodeURIComponent(code)}/expenses/${encodeURIComponent(expenseId)}`,
      {
        method: 'DELETE',
        code,
      },
    );
  },
};
