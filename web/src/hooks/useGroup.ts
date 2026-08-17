/**
 * Estado de un grupo: carga, sesión y mutaciones.
 *
 * Estrategia de sincronización: cada mutación escribe en el servidor y luego
 * relee el snapshot completo. Es un round-trip extra por acción, pero a cambio
 * el cliente nunca queda con estado divergente —algo muy fácil de lograr con
 * varias personas cargando gastos del mismo grupo al mismo tiempo—. En el
 * borde de Cloudflare esa relectura cuesta pocas decenas de milisegundos.
 *
 * El indicador `saving` es el que alimenta el "guardando..." de la cabecera.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExpenseInput, GroupSnapshot, UpdateGroupInput } from '@shared/types';
import { ApiClientError, api } from '../lib/api';
import { clearToken, getToken, rememberGroup } from '../lib/session';

export type GroupStatus =
  | 'loading'
  /** El grupo tiene PIN y no hay token válido guardado. */
  | 'pin-required'
  | 'ready'
  | 'not-found';

export interface UseGroupResult {
  status: GroupStatus;
  snapshot: GroupSnapshot | null;
  /** Error de la última operación, para mostrar en un banner. */
  error: string | null;
  saving: boolean;
  /** Error específico del PIN, para mostrarlo junto al input. */
  pinError: string | null;
  submitPin: (pin: string) => Promise<void>;
  refresh: () => Promise<void>;
  dismissError: () => void;
  addExpense: (input: ExpenseInput) => Promise<boolean>;
  editExpense: (id: string, input: ExpenseInput) => Promise<boolean>;
  removeExpense: (id: string) => Promise<boolean>;
  addMember: (name: string) => Promise<boolean>;
  renameMember: (id: string, name: string) => Promise<boolean>;
  removeMember: (id: string) => Promise<boolean>;
  updateSettings: (patch: UpdateGroupInput) => Promise<boolean>;
}

export function useGroup(code: string): UseGroupResult {
  const [status, setStatus] = useState<GroupStatus>('loading');
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Evita escribir estado después de que el componente se desmontó, o de que
  // el usuario navegó a otro grupo con una request en vuelo.
  const activeCode = useRef(code);
  useEffect(() => {
    activeCode.current = code;
  }, [code]);

  const isStale = useCallback((forCode: string) => activeCode.current !== forCode, []);

  const applySnapshot = useCallback((next: GroupSnapshot) => {
    setSnapshot(next);
    setStatus('ready');
    rememberGroup(next.group.code, next.group.name);
  }, []);

  /** Traduce un error de la API a estado de UI. */
  const handleError = useCallback((err: unknown, { asPinError = false } = {}): string => {
    if (err instanceof ApiClientError) {
      if (err.code === 'group_not_found') {
        setStatus('not-found');
        return err.message;
      }
      if (err.code === 'pin_required') {
        setStatus('pin-required');
        return err.message;
      }
      if (err.needsReauth) {
        clearToken(activeCode.current);
        setStatus('pin-required');
        if (asPinError) setPinError(err.message);
        return err.message;
      }
      if (asPinError) setPinError(err.message);
      else setError(err.message);
      return err.message;
    }
    const message = 'Ocurrió un error inesperado.';
    setError(message);
    return message;
  }, []);

  /**
   * Carga inicial: con token guardado hace GET; si no, abre sesión.
   *
   * No pone `status` en 'loading' al empezar: ese ya es el estado inicial, y el
   * componente se remonta (por `key`) cuando cambia el grupo. Evitar ese
   * setState sincrónico dentro del efecto es lo que impide un render en cascada.
   */
  const load = useCallback(
    async (forCode: string) => {
      try {
        if (getToken(forCode)) {
          const next = await api.getSnapshot(forCode);
          if (isStale(forCode)) return;
          applySnapshot(next);
          return;
        }

        // Sin token: probamos abrir sesión sin PIN. Funciona en grupos abiertos
        // y devuelve 403 pin_required en los protegidos.
        const result = await api.openSession(forCode);
        if (isStale(forCode)) return;
        applySnapshot(result.snapshot);
      } catch (err) {
        if (isStale(forCode)) return;
        handleError(err);
      }
    },
    [applySnapshot, handleError, isStale],
  );

  useEffect(() => {
    // La regla apunta a un problema real —setState sincrónico en un efecto
    // provoca renders en cascada—, pero acá el efecto sólo dispara el fetch
    // inicial y todo setState ocurre después de un await. Traer datos al montar
    // es el caso de uso legítimo del efecto; una librería de datos (TanStack
    // Query) lo encapsularía y haría innecesaria esta excepción.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(code);
  }, [code, load]);

  /**
   * Relee el grupo desde el servidor.
   *
   * Necesario porque varias personas cargan gastos a la vez: sin esto, la
   * única forma de ver lo que agregaron los demás sería recargar la página.
   */
  const refresh = useCallback(async () => {
    setSaving(true);
    try {
      const next = await api.getSnapshot(activeCode.current);
      applySnapshot(next);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }, [applySnapshot, handleError]);

  const submitPin = useCallback(
    async (pin: string) => {
      setPinError(null);
      setSaving(true);
      try {
        const result = await api.openSession(activeCode.current, pin);
        applySnapshot(result.snapshot);
      } catch (err) {
        handleError(err, { asPinError: true });
      } finally {
        setSaving(false);
      }
    },
    [applySnapshot, handleError],
  );

  /**
   * Corre una mutación y relee el snapshot. Devuelve `true` si salió bien,
   * para que el llamador sepa si puede cerrar el formulario.
   */
  const mutate = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        await action();
        const next = await api.getSnapshot(activeCode.current);
        applySnapshot(next);
        return true;
      } catch (err) {
        handleError(err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [applySnapshot, handleError],
  );

  const addExpense = useCallback(
    (input: ExpenseInput) => mutate(() => api.createExpense(activeCode.current, input)),
    [mutate],
  );

  const editExpense = useCallback(
    (id: string, input: ExpenseInput) =>
      mutate(() => api.updateExpense(activeCode.current, id, input)),
    [mutate],
  );

  const removeExpense = useCallback(
    (id: string) => mutate(() => api.deleteExpense(activeCode.current, id)),
    [mutate],
  );

  const addMember = useCallback(
    (name: string) => mutate(() => api.addMember(activeCode.current, name)),
    [mutate],
  );

  const renameMember = useCallback(
    (id: string, name: string) => mutate(() => api.renameMember(activeCode.current, id, name)),
    [mutate],
  );

  const removeMember = useCallback(
    (id: string) => mutate(() => api.deleteMember(activeCode.current, id)),
    [mutate],
  );

  const updateSettings = useCallback(
    (patch: UpdateGroupInput) => mutate(() => api.updateGroup(activeCode.current, patch)),
    [mutate],
  );

  const dismissError = useCallback(() => setError(null), []);

  return {
    status,
    snapshot,
    error,
    saving,
    pinError,
    submitPin,
    refresh,
    dismissError,
    addExpense,
    editExpense,
    removeExpense,
    addMember,
    renameMember,
    removeMember,
    updateSettings,
  };
}
