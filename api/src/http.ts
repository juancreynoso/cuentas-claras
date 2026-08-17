/** Helpers de request/response y el tipo de error que entiende el router. */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  // La API nunca debe cachearse: los gastos cambian todo el tiempo.
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json<T = unknown>(data: T, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_HEADERS, ...Object.fromEntries(new Headers(headers)) },
  });
}

/**
 * Error con status HTTP. Todo lo que se lanza acá termina como un JSON
 * `{ error, code }` legible por el cliente; cualquier otra excepción se
 * convierte en un 500 genérico para no filtrar detalles internos.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (msg: string, code = 'bad_request') => new ApiError(400, msg, code);
export const unauthorized = (msg = 'No autorizado', code = 'unauthorized') =>
  new ApiError(401, msg, code);
export const notFound = (msg = 'No encontrado', code = 'not_found') => new ApiError(404, msg, code);
export const conflict = (msg: string, code = 'conflict') => new ApiError(409, msg, code);

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: err.message, code: err.code }, err.status);
  }
  console.error('Error no manejado:', err);
  return json({ error: 'Error interno del servidor', code: 'internal' }, 500);
}

/** Parsea el body como JSON, con un límite de tamaño para evitar abuso. */
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    throw badRequest('El cuerpo del request es demasiado grande', 'payload_too_large');
  }

  const raw = await request.text();
  if (raw.length > maxBytes) {
    throw badRequest('El cuerpo del request es demasiado grande', 'payload_too_large');
  }
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw badRequest('JSON inválido', 'invalid_json');
  }
}
