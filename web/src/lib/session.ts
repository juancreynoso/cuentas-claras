/**
 * Guardado del token de sesión, por grupo.
 *
 * Se usa localStorage y no sessionStorage (que era lo que hacía la versión
 * original) para que volver a abrir el link no obligue a tipear el PIN otra
 * vez. La clave incluye el código del grupo: alguien puede estar en varios
 * viajes a la vez y cada uno tiene su propio token.
 */

const PREFIX = 'cc.token.';
const LAST_GROUPS_KEY = 'cc.recent';
const MAX_RECENT = 6;

/** localStorage tira excepción en modo privado de Safari y con cookies bloqueadas. */
function safeStorage(): Storage | null {
  try {
    const probe = '__cc_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

const store = safeStorage();

export function getToken(code: string): string | null {
  return store?.getItem(PREFIX + code.toUpperCase()) ?? null;
}

export function setToken(code: string, token: string): void {
  store?.setItem(PREFIX + code.toUpperCase(), token);
}

export function clearToken(code: string): void {
  store?.removeItem(PREFIX + code.toUpperCase());
}

export interface RecentGroup {
  code: string;
  name: string;
}

/** Grupos visitados, para ofrecerlos en la pantalla de inicio. */
export function getRecentGroups(): RecentGroup[] {
  const raw = store?.getItem(LAST_GROUPS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g): g is RecentGroup =>
        typeof g === 'object' &&
        g !== null &&
        typeof (g as RecentGroup).code === 'string' &&
        typeof (g as RecentGroup).name === 'string',
    );
  } catch {
    return [];
  }
}

export function rememberGroup(code: string, name: string): void {
  const upper = code.toUpperCase();
  const rest = getRecentGroups().filter((g) => g.code !== upper);
  const next = [{ code: upper, name }, ...rest].slice(0, MAX_RECENT);
  store?.setItem(LAST_GROUPS_KEY, JSON.stringify(next));
}

export function forgetGroup(code: string): void {
  const upper = code.toUpperCase();
  const next = getRecentGroups().filter((g) => g.code !== upper);
  store?.setItem(LAST_GROUPS_KEY, JSON.stringify(next));
  clearToken(upper);
}
