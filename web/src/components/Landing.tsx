/**
 * Pantalla de inicio: explica qué hace la app, permite crear un grupo o
 * entrar a uno con su código, y ofrece los grupos visitados recientemente.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, Input } from './ui';
import { IconClose } from './icons';
import { CreateGroupSheet } from './CreateGroupSheet';
import { forgetGroup, getRecentGroups } from '../lib/session';

const STEPS = [
  {
    title: 'Creá el grupo',
    text: 'Nombre del viaje, quiénes van y en qué moneda gastan.',
  },
  {
    title: 'Compartí el código',
    text: 'Cada grupo tiene un link propio. Sin cuentas, sin emails, sin contraseñas.',
  },
  {
    title: 'Cargá los gastos',
    text: 'Quién pagó y entre quiénes se divide. El reparto se calcula solo.',
  },
  {
    title: 'Saldá en pocos pasos',
    text: 'La app resuelve la menor cantidad de transferencias para que nadie quede debiendo.',
  },
];

export function Landing() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [recent, setRecent] = useState(getRecentGroups);

  const trimmedCode = code.trim().toUpperCase();
  const canJoin = /^[A-Z0-9]{4,12}$/.test(trimmedCode);

  function join() {
    if (canJoin) void navigate(`/g/${trimmedCode}`);
  }

  function removeRecent(groupCode: string) {
    forgetGroup(groupCode);
    setRecent(getRecentGroups());
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-20 pb-12">
      <header className="mb-9">
        <h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight">Cuentas Claras</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Dividí los gastos de un viaje en grupo y descubrí quién le debe a quién, con las mínimas
          transferencias posibles.
        </p>
      </header>

      <Button onClick={() => setCreating(true)} className="mb-3 w-full">
        Crear un grupo
      </Button>

      <form
        className="mb-10"
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ya tengo un código"
            aria-label="Código de grupo"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="text-center font-mono tracking-[0.2em] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
          />
          <Button type="submit" variant="ghost" disabled={!canJoin} className="shrink-0">
            Entrar
          </Button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-2.5 text-[13px] font-medium text-muted">Tus grupos</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {recent.map((group) => (
              <li key={group.code} className="flex items-center bg-canvas">
                <button
                  onClick={() => void navigate(`/g/${group.code}`)}
                  className="flex flex-1 items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span className="truncate text-sm font-medium">{group.name}</span>
                  <span className="shrink-0 font-mono text-xs tracking-widest text-muted">
                    {group.code}
                  </span>
                </button>
                <IconButton
                  label={`Quitar ${group.name} de la lista`}
                  onClick={() => removeRecent(group.code)}
                  className="mr-1.5 h-8 w-8"
                >
                  <IconClose size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-auto">
        <h2 className="mb-4 text-[13px] font-medium text-muted">Cómo funciona</h2>
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span
                className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[11px] text-muted"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 border-t border-border pt-6 text-[13px] text-muted">
        <p>
          Proyecto de código abierto ·{' '}
          <a
            href="https://github.com/juancreynoso/cuentas-claras"
            target="_blank"
            rel="noreferrer noopener"
            className="text-ink underline decoration-border underline-offset-2 transition-colors hover:decoration-ink"
          >
            ver en GitHub
          </a>
        </p>
      </footer>

      <CreateGroupSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(newCode) => void navigate(`/g/${newCode}`)}
      />
    </main>
  );
}
