/**
 * Pantalla de inicio: explica qué hace la app, permite crear un grupo o
 * entrar a uno con su código, y ofrece los grupos visitados recientemente.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from './ui';
import { CreateGroupSheet } from './CreateGroupSheet';
import { forgetGroup, getRecentGroups } from '../lib/session';

const STEPS = [
  {
    icon: '👥',
    title: 'Creá el grupo',
    text: 'Nombre del viaje, quiénes van y en qué moneda gastan.',
  },
  {
    icon: '🔗',
    title: 'Compartí el código',
    text: 'Cada grupo tiene un link propio. Sin cuentas, sin emails, sin contraseñas.',
  },
  {
    icon: '🧾',
    title: 'Cargá los gastos',
    text: 'Quién pagó y entre quiénes se divide. El reparto se calcula solo.',
  },
  {
    icon: '⚖️',
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
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-16 pb-12">
      <header className="mb-10 text-center">
        <div className="mb-4 text-5xl" aria-hidden="true">
          ✈️
        </div>
        <h1 className="text-4xl leading-tight font-bold">
          Cuentas <span className="text-accent">Claras</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          Dividí los gastos de un viaje en grupo y descubrí quién le debe a quién, con las mínimas
          transferencias posibles.
        </p>
      </header>

      <div className="mb-4">
        <Button onClick={() => setCreating(true)} className="w-full">
          Crear un grupo nuevo
        </Button>
      </div>

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
            className="text-center font-mono tracking-[0.25em] uppercase placeholder:tracking-normal placeholder:normal-case"
          />
          <Button type="submit" variant="ghost" disabled={!canJoin} className="shrink-0 px-5">
            Entrar
          </Button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            Tus grupos
          </h2>
          <ul className="space-y-2">
            {recent.map((group) => (
              <li key={group.code} className="flex items-center gap-2">
                <button
                  onClick={() => void navigate(`/g/${group.code}`)}
                  className="flex flex-1 items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/50"
                >
                  <span className="truncate text-sm font-semibold">{group.name}</span>
                  <span className="ml-3 shrink-0 font-mono text-xs tracking-widest text-accent">
                    {group.code}
                  </span>
                </button>
                <button
                  onClick={() => removeRecent(group.code)}
                  className="shrink-0 px-2 text-muted-dim transition-colors hover:text-danger"
                  aria-label={`Quitar ${group.name} de la lista`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-auto">
        <h2 className="mb-4 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          Cómo funciona
        </h2>
        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5">
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-base"
                aria-hidden="true"
              >
                {step.icon}
              </span>
              <div>
                <p className="text-sm font-semibold">
                  <span className="mr-1.5 font-mono text-xs text-accent">{index + 1}</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 border-t border-border-soft pt-6 text-center text-xs text-muted-dim">
        <p>
          Proyecto de código abierto ·{' '}
          <a
            href="https://github.com/juancreynoso/cuentas-claras"
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted underline decoration-dotted transition-colors hover:text-accent"
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
