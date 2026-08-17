/**
 * Cuentas Claras — Worker.
 *
 * Un solo Worker sirve la API bajo /api/* y el SPA en todo lo demás. Al
 * compartir origen no hay CORS, ni preflight, ni dos dominios que mantener.
 *
 * Modelo de acceso: no hay usuarios. Un grupo se identifica por un código
 * compartible y se protege con un PIN opcional. Al entrar, el cliente cambia
 * (código + PIN) por un token firmado con HMAC que acompaña cada escritura.
 */

import type { GroupSnapshot, SessionResponse } from '@shared/types';
import {
  ApiError,
  errorResponse,
  json,
  notFound,
  readJson,
  unauthorized,
  badRequest,
} from './http';
import { signSession, verifySession, verifyPin } from './crypto';
import { Repo } from './repo';
import {
  validateCreateGroup,
  validateExpense,
  validateGroupCode,
  validateMember,
  validatePin,
  validateUpdateGroup,
} from './validate';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
}

/**
 * Un año sin ninguna escritura. Un viaje se salda en semanas, así que doce
 * meses sin tocar el grupo es señal inequívoca de abandono; el margen es
 * amplio a propósito, porque borrar el viaje de alguien que vuelve es mucho
 * peor que guardar unos kilobytes de más.
 */
const ABANDONED_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Los assets se sirven antes de llegar acá (run_worker_first = ["/api/*"]).
    // Este fallback cubre una config incompleta en lugar de devolver un 404 raro.
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      return await route(request, env, url);
    } catch (err) {
      return errorResponse(err);
    }
  },

  /**
   * Cron semanal: borra los grupos abandonados.
   *
   * Va en `waitUntil` para que la tarea complete aunque el handler retorne, y
   * el error se traga a propósito: si una corrida falla, la siguiente lo
   * vuelve a intentar. Nada depende de que esto ocurra a tiempo.
   */
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Sin `await`: `waitUntil` ya mantiene viva la tarea después de retornar.
    ctx.waitUntil(purgeAbandonedGroups(env));
  },
} satisfies ExportedHandler<Env>;

async function purgeAbandonedGroups(env: Env): Promise<void> {
  try {
    const cutoff = Date.now() - ABANDONED_AFTER_MS;
    const deleted = await new Repo(env.DB).purgeGroupsInactiveSince(cutoff);
    console.log(
      `Limpieza: ${deleted} grupo(s) sin actividad desde ${new Date(cutoff).toISOString()}`,
    );
  } catch (err) {
    console.error('Falló la limpieza de grupos abandonados:', err);
  }
}

/** El secreto de sesión no tiene default: sin él, la firma no vale nada. */
function requireSecret(env: Env): string {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    console.error('SESSION_SECRET ausente o demasiado corto (mínimo 32 caracteres)');
    throw new ApiError(500, 'El servidor no está configurado correctamente', 'misconfigured');
  }
  return secret;
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;
  const segments = url.pathname.split('/').filter(Boolean); // ['api', 'groups', ...]

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'GET, POST, PATCH, DELETE' } });
  }

  if (segments.length === 2 && segments[1] === 'health') {
    return json({ ok: true, service: 'cuentas-claras' });
  }

  if (segments[1] !== 'groups') throw notFound('Ruta inexistente', 'unknown_route');

  const repo = new Repo(env.DB);

  // POST /api/groups — crear grupo (única ruta que no requiere sesión)
  if (segments.length === 2 && method === 'POST') {
    return createGroup(request, env, repo);
  }

  const code = validateGroupCode(segments[2]);

  // POST /api/groups/:code/session — canjear PIN por token
  if (segments.length === 4 && segments[3] === 'session' && method === 'POST') {
    return openSession(request, env, repo, code);
  }

  // A partir de acá todo requiere sesión válida para ese grupo.
  const groupRow = await repo.requireGroupRowByCode(code);
  await requireSession(request, env, groupRow.id);
  const groupId = groupRow.id;

  // /api/groups/:code
  if (segments.length === 3) {
    if (method === 'GET') {
      return json<GroupSnapshot>(await repo.getSnapshot(groupRow));
    }
    if (method === 'PATCH') {
      await repo.updateGroup(groupId, validateUpdateGroup(await readJson(request)));
      const updated = await repo.requireGroupRowByCode(code);
      return json<GroupSnapshot>(await repo.getSnapshot(updated));
    }
    if (method === 'DELETE') {
      await repo.deleteGroup(groupId);
      return json({ ok: true });
    }
  }

  // /api/groups/:code/members
  if (segments.length === 4 && segments[3] === 'members' && method === 'POST') {
    const { name } = validateMember(await readJson(request));
    return json({ member: await repo.addMember(groupId, name) }, 201);
  }

  // /api/groups/:code/members/:memberId
  if (segments.length === 5 && segments[3] === 'members') {
    const memberId = segments[4] as string;
    if (method === 'PATCH') {
      const { name } = validateMember(await readJson(request));
      await repo.renameMember(groupId, memberId, name);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await repo.deleteMember(groupId, memberId);
      return json({ ok: true });
    }
  }

  // /api/groups/:code/expenses
  if (segments.length === 4 && segments[3] === 'expenses' && method === 'POST') {
    const input = validateExpense(await readJson(request));
    await assertMembersBelongToGroup(repo, groupId, input.payerId, input.participantIds);
    const id = await repo.createExpense(groupId, input);
    return json({ id }, 201);
  }

  // /api/groups/:code/expenses/:expenseId
  if (segments.length === 5 && segments[3] === 'expenses') {
    const expenseId = segments[4] as string;
    if (method === 'PATCH') {
      const input = validateExpense(await readJson(request));
      await assertMembersBelongToGroup(repo, groupId, input.payerId, input.participantIds);
      await repo.updateExpense(groupId, expenseId, input);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await repo.deleteExpense(groupId, expenseId);
      return json({ ok: true });
    }
  }

  throw notFound('Ruta inexistente', 'unknown_route');
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function createGroup(request: Request, env: Env, repo: Repo): Promise<Response> {
  const secret = requireSecret(env);
  const input = validateCreateGroup(await readJson(request));
  const { groupId, code } = await repo.createGroup(input);

  const row = await repo.requireGroupRowByCode(code);
  const snapshot = await repo.getSnapshot(row);

  return json<SessionResponse & { snapshot: GroupSnapshot }>(
    {
      token: await signSession(groupId, secret),
      group: snapshot.group,
      snapshot,
    },
    201,
  );
}

async function openSession(
  request: Request,
  env: Env,
  repo: Repo,
  code: string,
): Promise<Response> {
  const secret = requireSecret(env);
  const row = await repo.requireGroupRowByCode(code);
  const body = (await readJson(request)) as { pin?: unknown };

  if (row.pin_hash && row.pin_salt) {
    const pin = validatePin(body.pin);
    if (!pin) {
      throw new ApiError(403, 'Este grupo está protegido con un PIN', 'pin_required');
    }
    if (!(await verifyPin(pin, row.pin_hash, row.pin_salt))) {
      throw unauthorized('PIN incorrecto', 'wrong_pin');
    }
  }

  const snapshot = await repo.getSnapshot(row);
  return json<SessionResponse & { snapshot: GroupSnapshot }>({
    token: await signSession(row.id, secret),
    group: snapshot.group,
    snapshot,
  });
}

// ── Autorización ─────────────────────────────────────────────────────────────

/**
 * Verifica que el token del header corresponda a ESTE grupo.
 *
 * Comparar el group id del token contra el de la URL es lo que evita que una
 * sesión válida para un grupo sirva para escribir en otro.
 */
async function requireSession(request: Request, env: Env, groupId: string): Promise<void> {
  const secret = requireSecret(env);
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) throw unauthorized('Falta el token de sesión', 'missing_session');

  const tokenGroupId = await verifySession(token, secret);
  if (tokenGroupId !== groupId) {
    throw unauthorized('El token no corresponde a este grupo', 'session_group_mismatch');
  }
}

/**
 * El pagador y los participantes tienen que pertenecer al grupo.
 *
 * Las FK garantizan que los ids existan en `members`, pero no que sean de
 * ESTE grupo: sin este chequeo se podría asignar un gasto a un integrante de
 * otro grupo cuyo id se conozca.
 */
async function assertMembersBelongToGroup(
  repo: Repo,
  groupId: string,
  payerId: string,
  participantIds: string[],
): Promise<void> {
  const valid = new Set(await repo.listMemberIds(groupId));

  if (!valid.has(payerId)) {
    throw badRequest('Quien pagó no es integrante de este grupo', 'invalid_payer');
  }
  const unknown = participantIds.filter((id) => !valid.has(id));
  if (unknown.length > 0) {
    throw badRequest(
      'Hay participantes que no son integrantes de este grupo',
      'invalid_participant',
    );
  }
}
