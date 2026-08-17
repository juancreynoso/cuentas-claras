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
import { IconLock } from './icons';

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-8">
      <IconLock size={22} className="mb-4 text-muted" />
      <h1 className="text-xl font-semibold tracking-tight">Grupo protegido</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        Ingresá el PIN para entrar a{' '}
        <span className="font-mono tracking-[0.15em] text-ink">{code}</span>
      </p>

      <form
        className="mt-6"
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
          className="mb-2.5 text-center tracking-[0.25em] placeholder:tracking-normal"
        />
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {submitting ? 'Verificando...' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-2.5 min-h-5 text-[13px] text-danger" role="alert">
        {error}
      </p>

      <Link to="/" className="mt-4 text-[13px] text-muted transition-colors hover:text-ink">
        ← Volver al inicio
      </Link>
    </main>
  );
}
