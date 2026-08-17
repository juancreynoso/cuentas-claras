/**
 * Acceso a D1. Toda la SQL vive acá; los handlers no escriben queries.
 *
 * Dos criterios:
 *  - Nada de N+1: el snapshot de un grupo se arma con tres queries fijas,
 *    sin importar cuántos gastos tenga.
 *  - Las escrituras que tocan varias tablas van en `db.batch()`, que D1
 *    ejecuta como una transacción implícita.
 */

import type {
  CreateGroupInput,
  Expense,
  ExpenseInput,
  Group,
  GroupSnapshot,
  Member,
  UpdateGroupInput,
} from '@shared/types';
import { LIMITS } from '@shared/types';
import { colorForIndex } from '@shared/colors';
import { generateGroupCode, generateId, hashPin } from './crypto';
import { conflict, notFound } from './http';

// ── Formas de las filas tal como salen de SQLite ─────────────────────────────

interface GroupRow {
  id: string;
  code: string;
  name: string;
  currency: string;
  secondary_currency: string | null;
  secondary_rate: number | null;
  pin_hash: string | null;
  pin_salt: string | null;
  created_at: number;
  updated_at: number;
}

interface MemberRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface ExpenseRow {
  id: string;
  description: string;
  amount_cents: number;
  spent_on: string;
  payer_id: string;
  category: string | null;
  created_at: number;
}

/** La fila cruda incluye el hash del PIN; el DTO público jamás lo expone. */
function toGroup(row: GroupRow): Group {
  return {
    code: row.code,
    name: row.name,
    currency: row.currency,
    secondaryCurrency: row.secondary_currency,
    secondaryRate: row.secondary_rate,
    hasPin: row.pin_hash !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class Repo {
  constructor(private readonly db: D1Database) {}

  // ── Grupos ─────────────────────────────────────────────────────────────────

  async findGroupRowByCode(code: string): Promise<GroupRow | null> {
    return this.db.prepare('SELECT * FROM groups WHERE code = ?').bind(code).first<GroupRow>();
  }

  async requireGroupRowByCode(code: string): Promise<GroupRow> {
    const row = await this.findGroupRowByCode(code);
    if (!row) throw notFound('No existe ningún grupo con ese código', 'group_not_found');
    return row;
  }

  /**
   * Crea el grupo y sus integrantes en un solo batch.
   *
   * El código se genera al azar; ante una colisión (improbable pero posible:
   * 887M combinaciones) se reintenta. Si en 5 intentos no hay lugar, algo
   * anda mal y es mejor fallar que colgarse.
   */
  async createGroup(input: CreateGroupInput): Promise<{ groupId: string; code: string }> {
    const groupId = generateId();
    const now = Date.now();
    const pin = input.pin ? await hashPin(input.pin) : null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateGroupCode();

      const statements = [
        this.db
          .prepare(
            `INSERT INTO groups
               (id, code, name, currency, secondary_currency, secondary_rate,
                pin_hash, pin_salt, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            groupId,
            code,
            input.name,
            input.currency,
            input.secondaryCurrency ?? null,
            input.secondaryRate ?? null,
            pin?.hash ?? null,
            pin?.salt ?? null,
            now,
            now,
          ),
        ...input.memberNames.map((name, index) =>
          this.db
            .prepare(
              'INSERT INTO members (id, group_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)',
            )
            .bind(generateId(), groupId, name, colorForIndex(index), index),
        ),
      ];

      try {
        await this.db.batch(statements);
        return { groupId, code };
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 4) continue;
        throw err;
      }
    }

    throw conflict('No se pudo generar un código libre, probá de nuevo', 'code_generation_failed');
  }

  async updateGroup(groupId: string, patch: UpdateGroupInput): Promise<void> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    if (patch.name !== undefined) {
      sets.push('name = ?');
      values.push(patch.name);
    }
    if (patch.currency !== undefined) {
      sets.push('currency = ?');
      values.push(patch.currency);
    }
    if (patch.secondaryCurrency !== undefined) {
      sets.push('secondary_currency = ?');
      values.push(patch.secondaryCurrency);
    }
    if (patch.secondaryRate !== undefined) {
      sets.push('secondary_rate = ?');
      values.push(patch.secondaryRate);
    }
    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(Date.now());

    await this.db
      .prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values, groupId)
      .run();
  }

  async deleteGroup(groupId: string): Promise<void> {
    // ON DELETE CASCADE se encarga de members, expenses y participantes.
    await this.db.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run();
  }

  /**
   * Borra los grupos sin actividad desde `cutoff` (ms epoch). Devuelve cuántos.
   *
   * Se apoya en el mismo CASCADE que `deleteGroup`, así que no deja integrantes
   * ni gastos huérfanos. `updated_at` lo refresca `touchGroup` en cada
   * escritura, con lo cual mide actividad real y no antigüedad del grupo.
   */
  async purgeGroupsInactiveSince(cutoff: number): Promise<number> {
    // Contamos antes de borrar en lugar de usar `meta.changes`: D1 incluye ahí
    // las filas eliminadas en cascada, así que un grupo con dos integrantes
    // reporta 3 y el número del log no significaría nada. De paso, evita
    // ejecutar el DELETE cuando no hay nada que limpiar.
    const doomed = await this.db
      .prepare('SELECT COUNT(*) AS n FROM groups WHERE updated_at < ?')
      .bind(cutoff)
      .first<{ n: number }>();

    const count = doomed?.n ?? 0;
    if (count === 0) return 0;

    await this.db.prepare('DELETE FROM groups WHERE updated_at < ?').bind(cutoff).run();
    return count;
  }

  // ── Snapshot completo ──────────────────────────────────────────────────────

  async getSnapshot(row: GroupRow): Promise<GroupSnapshot> {
    const results = await this.db.batch([
      this.db
        .prepare(
          'SELECT id, name, color, sort_order FROM members WHERE group_id = ? ORDER BY sort_order',
        )
        .bind(row.id),
      this.db
        .prepare(
          `SELECT id, description, amount_cents, spent_on, payer_id, category, created_at
             FROM expenses WHERE group_id = ?
            ORDER BY spent_on DESC, created_at DESC`,
        )
        .bind(row.id),
      // Join sobre expenses para traer sólo los participantes de este grupo.
      this.db
        .prepare(
          `SELECT ep.expense_id, ep.member_id
             FROM expense_participants ep
             JOIN expenses e ON e.id = ep.expense_id
            WHERE e.group_id = ?`,
        )
        .bind(row.id),
    ]);

    // `batch` devuelve un resultado por statement, en orden. Indexamos con
    // fallback porque el tipo no garantiza la longitud del array.
    const memberRows = (results[0]?.results ?? []) as unknown as MemberRow[];
    const expenseRows = (results[1]?.results ?? []) as unknown as ExpenseRow[];
    const participantRows = (results[2]?.results ?? []) as unknown as {
      expense_id: string;
      member_id: string;
    }[];

    const byExpense = new Map<string, string[]>();
    for (const { expense_id, member_id } of participantRows) {
      const list = byExpense.get(expense_id);
      if (list) list.push(member_id);
      else byExpense.set(expense_id, [member_id]);
    }

    const members: Member[] = memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      sortOrder: m.sort_order,
    }));

    const expenses: Expense[] = expenseRows.map((e) => ({
      id: e.id,
      description: e.description,
      amountCents: e.amount_cents,
      spentOn: e.spent_on,
      payerId: e.payer_id,
      category: e.category,
      participantIds: byExpense.get(e.id) ?? [],
      createdAt: e.created_at,
    }));

    return { group: toGroup(row), members, expenses };
  }

  // ── Integrantes ────────────────────────────────────────────────────────────

  async listMemberIds(groupId: string): Promise<string[]> {
    const result = await this.db
      .prepare('SELECT id FROM members WHERE group_id = ?')
      .bind(groupId)
      .all<{ id: string }>();
    return (result.results ?? []).map((r) => r.id);
  }

  async addMember(groupId: string, name: string): Promise<Member> {
    const existing = await this.db
      .prepare('SELECT COUNT(*) AS n, MAX(sort_order) AS max_order FROM members WHERE group_id = ?')
      .bind(groupId)
      .first<{ n: number; max_order: number | null }>();

    const count = existing?.n ?? 0;
    if (count >= LIMITS.membersPerGroup.max) {
      throw conflict(
        `Un grupo admite hasta ${LIMITS.membersPerGroup.max} integrantes`,
        'too_many_members',
      );
    }

    const duplicate = await this.db
      .prepare('SELECT id FROM members WHERE group_id = ? AND lower(name) = lower(?)')
      .bind(groupId, name)
      .first<{ id: string }>();
    if (duplicate) throw conflict(`Ya hay un integrante llamado "${name}"`, 'duplicate_member');

    const sortOrder = (existing?.max_order ?? -1) + 1;
    const member: Member = {
      id: generateId(),
      name,
      color: colorForIndex(sortOrder),
      sortOrder,
    };

    await this.db
      .prepare('INSERT INTO members (id, group_id, name, color, sort_order) VALUES (?, ?, ?, ?, ?)')
      .bind(member.id, groupId, member.name, member.color, member.sortOrder)
      .run();

    return member;
  }

  async renameMember(groupId: string, memberId: string, name: string): Promise<void> {
    const duplicate = await this.db
      .prepare('SELECT id FROM members WHERE group_id = ? AND lower(name) = lower(?) AND id != ?')
      .bind(groupId, name, memberId)
      .first<{ id: string }>();
    if (duplicate) throw conflict(`Ya hay un integrante llamado "${name}"`, 'duplicate_member');

    const result = await this.db
      .prepare('UPDATE members SET name = ? WHERE id = ? AND group_id = ?')
      .bind(name, memberId, groupId)
      .run();

    if (!result.meta.changes) throw notFound('Ese integrante no existe', 'member_not_found');
  }

  /**
   * Borra un integrante, pero sólo si no dejaría gastos inconsistentes.
   * La FK con RESTRICT ya lo impediría; validamos antes para poder devolver un
   * mensaje que explique el motivo en lugar de un error de constraint.
   */
  async deleteMember(groupId: string, memberId: string): Promise<void> {
    const [paid, remaining] = await Promise.all([
      this.db
        .prepare('SELECT COUNT(*) AS n FROM expenses WHERE group_id = ? AND payer_id = ?')
        .bind(groupId, memberId)
        .first<{ n: number }>(),
      this.db
        .prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?')
        .bind(groupId)
        .first<{ n: number }>(),
    ]);

    if ((paid?.n ?? 0) > 0) {
      throw conflict(
        `No se puede eliminar: esta persona pagó ${paid?.n} gasto(s). Editá o borrá esos gastos primero.`,
        'member_has_expenses',
      );
    }
    if ((remaining?.n ?? 0) <= 1) {
      throw conflict('El grupo necesita al menos un integrante', 'last_member');
    }

    // Un gasto podría quedar sin participantes si esta persona era la única.
    // Lo detectamos primero para no dejar gastos huérfanos de participación.
    const orphaned = await this.db
      .prepare(
        `SELECT e.id FROM expenses e
          WHERE e.group_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM expense_participants ep
               WHERE ep.expense_id = e.id AND ep.member_id != ?
            )
            AND EXISTS (
              SELECT 1 FROM expense_participants ep
               WHERE ep.expense_id = e.id AND ep.member_id = ?
            )`,
      )
      .bind(groupId, memberId, memberId)
      .all<{ id: string }>();

    if ((orphaned.results ?? []).length > 0) {
      throw conflict(
        `No se puede eliminar: es el único participante de ${orphaned.results.length} gasto(s).`,
        'member_sole_participant',
      );
    }

    const result = await this.db
      .prepare('DELETE FROM members WHERE id = ? AND group_id = ?')
      .bind(memberId, groupId)
      .run();

    if (!result.meta.changes) throw notFound('Ese integrante no existe', 'member_not_found');
    await this.touchGroup(groupId);
  }

  // ── Gastos ─────────────────────────────────────────────────────────────────

  async countExpenses(groupId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COUNT(*) AS n FROM expenses WHERE group_id = ?')
      .bind(groupId)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async createExpense(groupId: string, input: ExpenseInput): Promise<string> {
    if ((await this.countExpenses(groupId)) >= LIMITS.expensesPerGroup) {
      throw conflict(
        `Este grupo alcanzó el límite de ${LIMITS.expensesPerGroup} gastos`,
        'too_many_expenses',
      );
    }

    const expenseId = generateId();
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO expenses
             (id, group_id, description, amount_cents, spent_on, payer_id, category, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          expenseId,
          groupId,
          input.description,
          input.amountCents,
          input.spentOn,
          input.payerId,
          input.category ?? null,
          Date.now(),
        ),
      ...input.participantIds.map((memberId) =>
        this.db
          .prepare('INSERT INTO expense_participants (expense_id, member_id) VALUES (?, ?)')
          .bind(expenseId, memberId),
      ),
    ]);

    await this.touchGroup(groupId);
    return expenseId;
  }

  async updateExpense(groupId: string, expenseId: string, input: ExpenseInput): Promise<void> {
    const existing = await this.db
      .prepare('SELECT id FROM expenses WHERE id = ? AND group_id = ?')
      .bind(expenseId, groupId)
      .first<{ id: string }>();
    if (!existing) throw notFound('Ese gasto no existe', 'expense_not_found');

    // Reemplazamos la lista de participantes completa en lugar de calcular un
    // diff: son pocas filas y así no hay estados intermedios raros.
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE expenses
              SET description = ?, amount_cents = ?, spent_on = ?, payer_id = ?, category = ?
            WHERE id = ? AND group_id = ?`,
        )
        .bind(
          input.description,
          input.amountCents,
          input.spentOn,
          input.payerId,
          input.category ?? null,
          expenseId,
          groupId,
        ),
      this.db.prepare('DELETE FROM expense_participants WHERE expense_id = ?').bind(expenseId),
      ...input.participantIds.map((memberId) =>
        this.db
          .prepare('INSERT INTO expense_participants (expense_id, member_id) VALUES (?, ?)')
          .bind(expenseId, memberId),
      ),
    ]);

    await this.touchGroup(groupId);
  }

  async deleteExpense(groupId: string, expenseId: string): Promise<void> {
    const result = await this.db
      .prepare('DELETE FROM expenses WHERE id = ? AND group_id = ?')
      .bind(expenseId, groupId)
      .run();
    if (!result.meta.changes) throw notFound('Ese gasto no existe', 'expense_not_found');
    await this.touchGroup(groupId);
  }

  private async touchGroup(groupId: string): Promise<void> {
    await this.db
      .prepare('UPDATE groups SET updated_at = ? WHERE id = ?')
      .bind(Date.now(), groupId)
      .run();
  }
}

function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('UNIQUE constraint failed');
}
