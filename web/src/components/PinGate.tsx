/**
 * Pantalla de PIN para grupos protegidos.
 *
 * A diferencia del original —donde la contraseña estaba en el JS del cliente y
 * bastaba abrir el inspector para leerla— el PIN se verifica en el servidor
 * contra un hash PBKDF2, y lo que vuelve es un token firmado.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LIMITS } from '@shared/types';
import { Button, Input } from './ui';

interface Props {
  code: string;
  error: string | null;
  submitting: boolean;
  onSubmit: (pin: string) => void;
}

export function PinGate({ code, error, submitting, onSubmit }: Props) {
  const [pin, setPin] = useState('');
  const canSubmit = pin.length >= LIMITS.pin.min && !submitting;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 text-5xl" aria-hidden="true">
        🔒
      </div>
      <h1 className="text-2xl font-bold">Grupo protegido</h1>
      <p className="mt-2 mb-1 text-sm text-muted">Ingresá el PIN para entrar a</p>
      <p className="mb-8 font-mono text-sm tracking-[0.2em] text-accent">{code}</p>

      <form
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit(pin);
        }}
      >
        <Input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          placeholder="PIN"
          aria-label="PIN del grupo"
          maxLength={LIMITS.pin.max}
          autoComplete="current-password"
          autoFocus
          className="mb-3 text-center tracking-[0.3em] placeholder:tracking-normal"
        />
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {submitting ? 'Verificando...' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-3 min-h-5 text-[13px] text-danger" role="alert">
        {error}
      </p>

      <Link to="/" className="mt-6 text-[13px] text-muted transition-colors hover:text-white">
        ← Volver al inicio
      </Link>
    </main>
  );
}
