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
import { IconAlert, IconClose } from './icons';

// ── Botones ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'quiet';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-white font-semibold hover:bg-ink-soft disabled:bg-faint disabled:text-white/70',
  ghost:
    'bg-canvas text-ink font-semibold border border-border-strong hover:bg-surface-hover disabled:text-faint disabled:border-border',
  danger:
    'bg-canvas text-danger font-semibold border border-danger-border hover:bg-danger-surface disabled:opacity-40',
  quiet: 'text-muted font-medium hover:text-ink disabled:opacity-40',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded-lg px-4 py-3 text-[15px] transition-colors disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Botón sólo-ícono, para las acciones de la cabecera y de los sheets. */
export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40 ${className}`}
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
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const FIELD_CLASS =
  'w-full rounded-lg bg-canvas border border-border-strong px-3 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-ink';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...rest} />;
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${FIELD_CLASS} cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`}
      style={{
        // Chevron dibujado como data URI: evita superponer un ícono absoluto
        // y que el texto largo de una opción se meta debajo.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    />
  );
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
  md: 'w-9 h-9 text-[11px]',
  lg: 'w-10 h-10 text-[11px]',
};

/**
 * Iniciales en blanco sobre el color del integrante. La paleta está calculada
 * para que ese blanco tenga al menos 4.6:1 de contraste contra cualquiera de
 * los veinte colores (ver `@shared/colors`).
 */
export function Avatar({ name, color, size = 'md', dimmed = false, ring = false }: AvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-mono font-bold text-white transition-all ${AVATAR_SIZES[size]} ${dimmed ? 'opacity-25' : ''} ${ring ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

// ── Estados ──────────────────────────────────────────────────────────────────

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="animate-fade px-5 py-20 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

export function Loading({ label = 'Cargando...' }: { label?: string }) {
  return (
    <div className="py-20 text-center text-sm text-muted" role="status">
      <span className="inline-block animate-pulse">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="animate-rise mb-4 flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-surface px-3.5 py-3 text-[13px] text-danger"
      role="alert"
    >
      <IconAlert size={16} className="mt-px shrink-0" />
      <span className="flex-1 leading-relaxed">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          <IconClose size={16} />
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
    const timer = window.setTimeout(() => focusables()[0]?.focus(), 260);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      restoreFocusTo.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end transition-opacity duration-200 sm:items-center sm:justify-center ${
        open ? 'bg-ink/20 opacity-100' : 'pointer-events-none bg-transparent opacity-0'
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
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-canvas px-5 pt-5 pb-10 shadow-[0_-8px_40px_rgba(0,0,0,0.08)] transition-transform duration-250 ease-out sm:max-w-lg sm:rounded-2xl sm:border sm:pb-6 ${
          open ? 'translate-y-0' : 'translate-y-full sm:translate-y-4'
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose} className="-mr-2">
            <IconClose />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
