-- Cuentas Claras — schema D1 (SQLite)
--
-- Decisiones de diseño:
--  * El dinero se guarda en centavos enteros (amount_cents). Los floats
--    acumulan error de redondeo al dividir y sumar saldos: 0.1 + 0.2 != 0.3.
--    Con enteros el reparto es exacto y el resto se distribuye explícitamente.
--  * `code` es la clave pública compartible del grupo; `id` es interna.
--  * Todo cuelga de groups con ON DELETE CASCADE, así borrar un grupo no
--    deja filas huérfanas.
--  * Sin tabla de usuarios: el acceso es por código de grupo + PIN opcional.

DROP TABLE IF EXISTS expense_participants;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS groups;

CREATE TABLE groups (
  id                  TEXT    PRIMARY KEY,
  code                TEXT    NOT NULL UNIQUE,
  name                TEXT    NOT NULL,
  currency            TEXT    NOT NULL DEFAULT 'EUR',
  -- Moneda secundaria opcional para mostrar cada monto convertido, con la
  -- cotización que fija el grupo. Reemplaza al USD_RATE hardcodeado.
  secondary_currency  TEXT,
  secondary_rate      REAL,
  -- PIN opcional. Guardamos PBKDF2 (nunca el PIN en claro). NULL = grupo abierto.
  pin_hash            TEXT,
  pin_salt            TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE members (
  id         TEXT    PRIMARY KEY,
  group_id   TEXT    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE expenses (
  id           TEXT    PRIMARY KEY,
  group_id     TEXT    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description  TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  spent_on     TEXT    NOT NULL, -- ISO 'YYYY-MM-DD', ordenable como texto
  -- RESTRICT: no se puede borrar un integrante que pagó algo. La API lo
  -- valida antes y devuelve un error explicando qué gastos lo bloquean.
  payer_id     TEXT    NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  -- NULL = usar la categoría inferida por keywords en el cliente.
  category     TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE expense_participants (
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id  TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, member_id)
);

-- El lookup por código es la consulta más caliente: pasa en cada request.
CREATE UNIQUE INDEX idx_groups_code ON groups(code);
CREATE INDEX idx_members_group ON members(group_id, sort_order);
CREATE INDEX idx_expenses_group ON expenses(group_id, spent_on DESC, created_at DESC);
CREATE INDEX idx_expenses_payer ON expenses(payer_id);
CREATE INDEX idx_participants_member ON expense_participants(member_id);
