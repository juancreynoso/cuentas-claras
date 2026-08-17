/**
 * Test del formulario de gasto: es la interacción donde se cruzan el parseo de
 * dinero, el reparto entre participantes y la validación.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Group, Member } from '@shared/types';
import { ExpenseSheet } from './ExpenseSheet';

const group: Group = {
  code: 'A7K2P9',
  name: 'Europa 2026',
  currency: 'EUR',
  secondaryCurrency: null,
  secondaryRate: null,
  hasPin: false,
  createdAt: 0,
  updatedAt: 0,
};

const members: Member[] = [
  { id: 'm1', name: 'Ana', color: '#FF6B6B', sortOrder: 0 },
  { id: 'm2', name: 'Beto', color: '#4ECDC4', sortOrder: 1 },
  { id: 'm3', name: 'Caro', color: '#45B7D1', sortOrder: 2 },
];

function setup(overrides: Partial<Parameters<typeof ExpenseSheet>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(true);
  const onDelete = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();

  render(
    <ExpenseSheet
      open
      editing={null}
      session={1}
      group={group}
      members={members}
      saving={false}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      {...overrides}
    />,
  );

  return { onSave, onDelete, onClose, user: userEvent.setup() };
}

describe('ExpenseSheet', () => {
  it('empieza con todos los integrantes participando', () => {
    setup();
    for (const member of members) {
      expect(screen.getByRole('button', { name: `${member.name} (incluido)` })).toBeInTheDocument();
    }
  });

  it('deja guardar sólo cuando el formulario está completo', async () => {
    const { user } = setup();
    const save = screen.getByRole('button', { name: /agregar gasto/i });

    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/descripción/i), 'Cena');
    expect(save).toBeDisabled(); // falta el monto

    await user.type(screen.getByLabelText(/monto/i), '30');
    expect(save).toBeEnabled();
  });

  it('convierte el monto a centavos enteros al guardar', async () => {
    const { user, onSave } = setup();

    await user.type(screen.getByLabelText(/descripción/i), 'Cena en el puerto');
    await user.type(screen.getByLabelText(/monto/i), '30,50');
    await user.click(screen.getByRole('button', { name: /agregar gasto/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Cena en el puerto',
        amountCents: 3050,
        participantIds: expect.arrayContaining(['m1', 'm2', 'm3']),
      }),
    );
  });

  it('muestra el reparto por persona, incluido el centavo del resto', async () => {
    const { user } = setup();

    // 10 euros entre 3 no da exacto: uno paga 3,34 y los otros 3,33.
    await user.type(screen.getByLabelText(/monto/i), '10');

    const group1 = screen.getByRole('group', { name: /entre quiénes/i });
    expect(within(group1).getByText('3,34 €')).toBeInTheDocument();
    expect(within(group1).getAllByText('3,33 €')).toHaveLength(2);
  });

  it('recalcula el reparto al excluir a alguien', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/monto/i), '10');
    await user.click(screen.getByRole('button', { name: 'Caro (incluido)' }));

    const group1 = screen.getByRole('group', { name: /entre quiénes/i });
    expect(within(group1).getAllByText('5,00 €')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Caro (excluido)' })).toBeInTheDocument();
  });

  it('no deja guardar sin participantes', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/descripción/i), 'Cena');
    await user.type(screen.getByLabelText(/monto/i), '30');
    await user.click(screen.getByRole('button', { name: /^ninguno$/i }));

    expect(screen.getByRole('button', { name: /agregar gasto/i })).toBeDisabled();
    expect(screen.getByText(/elegí al menos una persona/i)).toBeInTheDocument();
  });

  it('avisa cuando el monto no es un número válido', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/monto/i), 'abc');

    expect(screen.getByText(/ingresá un monto válido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar gasto/i })).toBeDisabled();
  });

  it('sugiere la categoría inferida de la descripción', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/descripción/i), 'Uber al aeropuerto');

    expect(screen.getByText(/detectada automáticamente.*transporte/i)).toBeInTheDocument();
  });

  it('precarga los datos al editar y pide confirmación para borrar', async () => {
    const { user, onDelete } = setup({
      editing: {
        id: 'e1',
        description: 'Hotel',
        amountCents: 12000,
        spentOn: '2026-03-28',
        payerId: 'm2',
        category: null,
        participantIds: ['m1', 'm2'],
        createdAt: 0,
      },
    });

    expect(screen.getByLabelText(/descripción/i)).toHaveValue('Hotel');
    expect(screen.getByLabelText(/monto/i)).toHaveValue('120.00');
    expect(screen.getByRole('button', { name: 'Caro (excluido)' })).toBeInTheDocument();

    // El borrado es en dos pasos para que no se pierda un gasto por un toque.
    await user.click(screen.getByRole('button', { name: /^eliminar$/i }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /confirmar borrado/i }));
    expect(onDelete).toHaveBeenCalledWith('e1');
  });
});
