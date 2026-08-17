/**
 * Códigos de grupo, hashing de PIN y tokens de sesión.
 *
 * Todo usa WebCrypto, disponible nativamente en Workers: sin dependencias.
 */

import { unauthorized } from './http';

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L) porque el código se dicta por
// teléfono y se tipea a mano. 31^6 ≈ 887 millones de combinaciones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateGroupCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return out;
}

export function generateId(): string {
  return crypto.randomUUID();
}

// ── Base64url ────────────────────────────────────────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ── PIN (PBKDF2-SHA256) ──────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;

/** Deriva el hash de un PIN. Devuelve hash y salt, ambos en base64url. */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePin(pin, salt);
  return { hash: toBase64Url(hash), salt: toBase64Url(salt) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  try {
    const derived = await derivePin(pin, fromBase64Url(salt));
    return timingSafeEqual(derived, fromBase64Url(hash));
  } catch {
    return false;
  }
}

async function derivePin(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Comparación en tiempo constante. Un `===` sobre strings corta en el primer
 * byte distinto y filtra información por timing.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

// ── Tokens de sesión (HMAC-SHA256) ───────────────────────────────────────────

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

interface TokenPayload {
  /** group id */
  g: string;
  /** expiración en ms epoch */
  exp: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Token firmado `payload.signature`. No es un JWT completo a propósito: no
 * necesitamos negociación de algoritmos, y fijar HMAC-SHA256 evita toda la
 * familia de ataques de confusión de `alg`.
 */
export async function signSession(groupId: string, secret: string): Promise<string> {
  const payload: TokenPayload = { g: groupId, exp: Date.now() + SESSION_TTL_MS };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Devuelve el group id si el token es válido; lanza 401 si no. */
export async function verifySession(token: string, secret: string): Promise<string> {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) throw unauthorized('Sesión inválida', 'invalid_session');

  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    fromBase64Url(sig),
    new TextEncoder().encode(encoded),
  );
  if (!ok) throw unauthorized('Sesión inválida', 'invalid_session');

  let payload: TokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as TokenPayload;
  } catch {
    throw unauthorized('Sesión inválida', 'invalid_session');
  }

  if (typeof payload.g !== 'string' || typeof payload.exp !== 'number') {
    throw unauthorized('Sesión inválida', 'invalid_session');
  }
  if (payload.exp < Date.now()) {
    throw unauthorized('La sesión expiró, volvé a ingresar el PIN', 'session_expired');
  }
  return payload.g;
}
