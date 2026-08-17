/**
 * Pantalla principal de un grupo: cabecera, pestañas y formularios.
 *
 * Concentra el estado de UI (qué pestaña, qué sheet abierto) y delega los datos
 * a `useGroup`. Los cálculos derivados van en `useMemo` porque recorren todos
 * los gastos y se recalculan en cada render de cualquier otra cosa.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Expense } from '@shared/types';
import { computeBalances, settle, totalCents as sumExpenses } from '@shared/settlement';
import { useGroup } from '../hooks/useGroup';
import { makeFormatter } from '../lib/display';
import { ErrorBanner, Loading } from './ui';
import { GroupHeader } from './GroupHeader';
import { PinGate } from './PinGate';
import { ExpensesTab } from './ExpensesTab';
import { BalancesTab } from './BalancesTab';
import { StatsTab } from './StatsTab';
import { ExpenseSheet } from './ExpenseSheet';
import { SettingsSheet } from './SettingsSheet';
import { ShareSheet } from './ShareSheet';

type Tab = 'gastos' | 'saldos' | 'stats';

export function GroupPage({ code }: { code: string }) {
  const group = useGroup(code);
  const [tab, setTab] = useState<Tab>('gastos');
  const [expenseSheet, setExpenseSheet] = useState<{
    open: boolean;
    editing: Expense | null;
    session: number;
  }>({ open: false, editing: null, session: 0 });
  const [settings, setSettings] = useState({ open: false, session: 0 });
  const [shareOpen, setShareOpen] = useState(false);

  const snapshot = group.snapshot;

  const derived = useMemo(() => {
    if (!snapshot) return null;

    const memberIds = snapshot.members.map((m) => m.id);
    const balances = computeBalances(snapshot.expenses, memberIds);

    const paidByMember = new Map(balances.map((b) => [b.memberId, b.paidCents]));

    return {
      balances,
      transfers: settle(balances),
      paidByMember,
      total: sumExpenses(snapshot.expenses),
    };
  }, [snapshot]);

  if (group.status === 'pin-required') {
    return (
      <PinGate
        code={code}
        error={group.pinError}
        submitting={group.saving}
        onSubmit={(pin) => void group.submitPin(pin)}
      />
    );
  }

  if (group.status === 'not-found') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 text-5xl" aria-hidden="true">
          🧭
        </div>
        <h1 className="text-2xl font-bold">Grupo no encontrado</h1>
        <p className="mt-2 text-sm text-muted">
          No existe ningún grupo con el código <span className="font-mono text-accent">{code}</span>
          . Revisá que esté bien escrito.
        </p>
        <Link to="/" className="mt-6 text-[13px] text-muted transition-colors hover:text-white">
          ← Volver al inicio
        </Link>
      </main>
    );
  }

  if (group.status === 'loading' || !snapshot || !derived) {
    return (
      <main className="mx-auto max-w-lg">
        <Loading label="Cargando el grupo..." />
      </main>
    );
  }

  const money = makeFormatter(snapshot.group);
  const { balances, transfers, paidByMember, total } = derived;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'gastos', label: `💸 Gastos (${snapshot.expenses.length})` },
    { id: 'saldos', label: '⚖️ Quién debe' },
    { id: 'stats', label: '📊 Stats' },
  ];

  function openNewExpense() {
    setExpenseSheet((prev) => ({ open: true, editing: null, session: prev.session + 1 }));
  }

  function openEditExpense(expense: Expense) {
    setExpenseSheet((prev) => ({ open: true, editing: expense, session: prev.session + 1 }));
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <GroupHeader
        group={snapshot.group}
        members={snapshot.members}
        paidByMember={paidByMember}
        totalCents={total}
        money={money}
        saving={group.saving}
        onShare={() => setShareOpen(true)}
        onSettings={() => setSettings((prev) => ({ open: true, session: prev.session + 1 }))}
        onRefresh={() => void group.refresh()}
      />

      <nav
        className="sticky top-0 z-30 flex border-b border-border-soft bg-ink"
        aria-label="Vistas"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 border-b-2 px-2 py-3 text-[13px] font-semibold transition-colors ${
              tab === item.id
                ? 'border-accent text-white'
                : 'border-transparent text-muted hover:text-white/80'
            }`}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 px-4 pt-4 pb-28">
        {group.error && <ErrorBanner message={group.error} onDismiss={group.dismissError} />}

        {tab === 'gastos' && (
          <ExpensesTab
            expenses={snapshot.expenses}
            members={snapshot.members}
            money={money}
            onEdit={openEditExpense}
          />
        )}

        {tab === 'saldos' && (
          <BalancesTab
            balances={balances}
            transfers={transfers}
            members={snapshot.members}
            money={money}
            hasExpenses={snapshot.expenses.length > 0}
          />
        )}

        {tab === 'stats' && (
          <StatsTab
            expenses={snapshot.expenses}
            members={snapshot.members}
            money={money}
            totalCents={total}
            onEdit={openEditExpense}
          />
        )}
      </main>

      <button
        onClick={openNewExpense}
        className="fixed right-5 bottom-7 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-3xl leading-none text-white shadow-xl shadow-accent/40 transition-transform hover:scale-105"
        aria-label="Agregar gasto"
      >
        <span aria-hidden="true" className="-mt-0.5">
          +
        </span>
      </button>

      <ExpenseSheet
        open={expenseSheet.open}
        editing={expenseSheet.editing}
        session={expenseSheet.session}
        group={snapshot.group}
        members={snapshot.members}
        saving={group.saving}
        onClose={() => setExpenseSheet((prev) => ({ ...prev, open: false }))}
        onSave={(input) =>
          expenseSheet.editing
            ? group.editExpense(expenseSheet.editing.id, input)
            : group.addExpense(input)
        }
        onDelete={group.removeExpense}
      />

      <SettingsSheet
        open={settings.open}
        session={settings.session}
        group={snapshot.group}
        members={snapshot.members}
        saving={group.saving}
        onClose={() => setSettings((prev) => ({ ...prev, open: false }))}
        onUpdateGroup={group.updateSettings}
        onAddMember={group.addMember}
        onRenameMember={group.renameMember}
        onRemoveMember={group.removeMember}
      />

      <ShareSheet open={shareOpen} group={snapshot.group} onClose={() => setShareOpen(false)} />
    </div>
  );
}
