/**
 * Primitivas de UI compartidas.
 *
 * Viven en un solo archivo porque son chicas y se usan juntas; los componentes
 * con lógica de dominio tienen su propio archivo.
 */

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { initials } from '@shared/colors';

// ── Botones ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-accent to-accent-strong text-white font-bold shadow-lg shadow-accent/25 hover:-translate-y-px hover:shadow-accent/40 disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none',
  ghost: 'bg-surface text-white border border-border hover:border-accent/50 disabled:opacity-40',
  danger:
    'bg-danger/10 text-danger border border-danger/30 font-semibold hover:bg-danger/20 disabled:opacity-40',
  subtle: 'text-muted hover:text-white disabled:opacity-40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded-2xl px-5 py-3.5 text-[15px] transition-all disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Campos de formulario ─────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
}

/**
 * Envuelve un input con su label y su mensaje de error.
 * El `id` se genera acá y se pasa al hijo para que label e input queden
 * asociados sin que cada uso tenga que inventar un id único.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold tracking-[0.1em] text-muted uppercase"
      >
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-xs text-muted-dim">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const FIELD_CLASS =
  'w-full rounded-xl bg-surface border border-border px-3.5 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-muted-dim focus:border-accent';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD_CLASS} appearance-none ${className}`} {...rest} />;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  dimmed?: boolean;
  ring?: boolean;
}

const AVATAR_SIZES = {
  sm: 'w-6 h-6 text-[9px]',
  md: 'w-10 h-10 text-[11px]',
  lg: 'w-11 h-11 text-[11px]',
};

export function Avatar({ name, color, size = 'md', dimmed = false, ring = false }: AvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-mono font-bold text-black transition-all ${AVATAR_SIZES[size]} ${dimmed ? 'opacity-35' : ''} ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// ── Estados ──────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="animate-fade px-5 py-16 text-center">
      <div className="mb-4 text-5xl" aria-hidden="true">
        {icon}
      </div>
      <p className="text-base text-muted">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-xs text-sm text-muted-dim">{description}</p>}
    </div>
  );
}

export function Loading({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="py-16 text-center text-sm text-muted" role="status">
      <span className="inline-block animate-pulse">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="animate-rise mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger"
      role="alert"
    >
      <span aria-hidden="true">⚠️</span>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ── Sheet (modal inferior) ───────────────────────────────────────────────────

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Panel que sube desde abajo, el patrón nativo en mobile.
 *
 * Accesibilidad: rol de diálogo modal, cierra con Escape, atrapa el Tab
 * dentro del panel y devuelve el foco al elemento que lo abrió. Sin esto, un
 * usuario de teclado o lector de pantalla sigue navegando por detrás del modal.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    // Bloquea el scroll del fondo mientras el sheet está abierto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Foco al primer campo, tras la animación de entrada.
    const timer = window.setTimeout(() => focusables()[0]?.focus(), 280);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      restoreFocusTo.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end backdrop-blur-sm transition-opacity duration-250 ${
        open ? 'bg-black/75 opacity-100' : 'pointer-events-none bg-black/0 opacity-0'
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-ink-raised px-5 pt-6 pb-10 transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
