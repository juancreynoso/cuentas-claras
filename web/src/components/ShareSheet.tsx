/**
 * Panel para compartir el grupo.
 *
 * El código es la llave del grupo, así que la acción principal es copiarlo o
 * mandarlo. Si el navegador soporta la Web Share API se usa la hoja nativa del
 * sistema, que es lo que la gente espera en el teléfono.
 */

import { useEffect, useState } from 'react';
import type { Group } from '@shared/types';
import { Button, Sheet } from './ui';

interface Props {
  open: boolean;
  group: Group;
  onClose: () => void;
}

export function ShareSheet({ open, group, onClose }: Props) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const url = `${window.location.origin}/g/${group.code}`;

  // Resetea el "copiado" después de un momento.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): al menos
      // seleccionamos el texto para que se pueda copiar a mano.
      const selection = window.getSelection();
      const node = document.getElementById('share-code-text');
      if (selection && node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  async function share() {
    const data = {
      title: `Cuentas Claras · ${group.name}`,
      text: `Sumate a "${group.name}" para dividir los gastos del viaje:`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else await copy(url, 'link');
    } catch {
      // El usuario canceló la hoja de compartir: no es un error.
    }
  }

  return (
    <Sheet open={open} title="Compartir grupo" onClose={onClose}>
      <p className="mb-5 text-[13px] leading-relaxed text-muted">
        Cualquiera con este código puede cargar gastos en{' '}
        <span className="font-medium text-ink">{group.name}</span>
        {group.hasPin ? ' (le va a pedir el PIN).' : '. El grupo no tiene PIN.'}
      </p>

      <div className="mb-4 rounded-lg border border-border bg-surface px-5 py-7 text-center">
        <p className="mb-1.5 text-xs text-muted">Código del grupo</p>
        <p
          id="share-code-text"
          className="font-mono text-3xl font-bold tracking-[0.25em] select-all"
        >
          {group.code}
        </p>
      </div>

      <div className="mb-2.5 flex gap-2.5">
        <Button variant="ghost" onClick={() => void copy(group.code, 'code')} className="flex-1">
          {copied === 'code' ? 'Copiado' : 'Copiar código'}
        </Button>
        <Button variant="ghost" onClick={() => void copy(url, 'link')} className="flex-1">
          {copied === 'link' ? 'Copiado' : 'Copiar link'}
        </Button>
      </div>

      <Button onClick={() => void share()} className="w-full">
        Compartir
      </Button>

      {!group.hasPin && (
        <p className="mt-5 rounded-lg border border-border bg-surface px-3.5 py-3 text-[12px] leading-relaxed text-muted">
          Este grupo no tiene PIN: el link es la única llave. Tratalo como un documento compartido y
          mandalo sólo a quienes viajan con vos.
        </p>
      )}
    </Sheet>
  );
}
