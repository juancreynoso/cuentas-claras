# Cuentas Claras ✈️

**Dividí los gastos de un viaje en grupo y descubrí quién le debe a quién, con las mínimas transferencias posibles.** Sin registro, sin emails: creás un grupo, compartís el código y todos cargan gastos desde su teléfono.

<!-- Reemplazar por la URL propia después del primer deploy. -->

🔗 **[Ver la app en vivo](https://cuentas-claras.workers.dev)** · [Reportar algo](https://github.com/juancreynoso/cuentas-claras/issues)

---

## De dónde salió

Esto empezó como un archivo HTML de 700 líneas que escribí **durante un viaje por Europa**, en un hostel, porque a los cinco días de repartir cuentas a mano ya nadie sabía quién había puesto qué. Funcionaba: tenía los nombres de mis compañeros de viaje hardcodeados, una contraseña en el JavaScript y un `USD_RATE = 1.16` fijo.

Este repo es ese prototipo convertido en un producto que puede usar cualquiera. La versión original está guardada en [`docs/legacy/`](docs/legacy/) a propósito: el contraste entre las dos es la parte interesante.

|              | Prototipo (marzo 2026)                       | Ahora                                    |
| ------------ | -------------------------------------------- | ---------------------------------------- |
| Integrantes  | `const PERSONAS = ["Hernan", ...]`           | Los define quien crea el grupo           |
| Grupos       | Uno solo, global                             | Ilimitados, aislados por código          |
| Contraseña   | `const PASSWORD = "viaje2026"` en el cliente | PIN opcional, hash PBKDF2 en el servidor |
| Autorización | Ninguna: la API era pública y escribible     | Token firmado con HMAC, por grupo        |
| Moneda       | EUR con cotización fija a USD                | 18 monedas, secundaria configurable      |
| Dinero       | Floats (`monto / participantes.length`)      | Enteros en unidad menor, reparto exacto  |
| XSS          | `innerHTML` con texto del usuario            | React escapa por defecto + CSP           |
| Datos        | Una clave de KV con todo el array            | D1 (SQLite) normalizado, 4 tablas        |
| Tests        | —                                            | 89                                       |

---

## Qué hace

- **Grupos por código compartible.** Creás un grupo y obtenés una URL tipo `/g/A7K2P9`. Se manda por WhatsApp y listo. Sin cuentas que crear.
- **PIN opcional.** Si el grupo lo lleva, se verifica contra un hash en el servidor y devuelve un token de sesión de 30 días.
- **División flexible.** Cada gasto registra quién pagó y entre quiénes se reparte; no tiene que ser todo el grupo.
- **Liquidación mínima.** En lugar de una matriz de "todos contra todos", la app calcula la lista más corta de transferencias que salda el viaje.
- **Categorización automática.** Infiere la categoría de la descripción por palabras clave, en español y en inglés. Siempre se puede corregir a mano.
- **Doble moneda.** Cada monto se puede mostrar convertido a una segunda moneda con la cotización que fija el grupo.
- **Pensado para el teléfono.** Es donde se cargan los gastos: en la mesa del restaurante, no en un escritorio.

---

## Decisiones técnicas

Las cuatro que más forma le dieron al proyecto.

### 1. El dinero se guarda en enteros, no en floats

El prototipo dividía con `monto / participantes.length` sobre números decimales. Eso trae dos problemas: `0.1 + 0.2 !== 0.3`, y al dividir €10 entre 3 la suma de las partes no vuelve a dar €10 — aparecen o desaparecen centavos.

Ahora todo monto viaja y se guarda como entero en la unidad menor de la moneda, y el reparto distribuye el resto explícitamente:

```ts
splitCents(1000, ['ana', 'beto', 'caro']);
// → ana: 334, beto: 333, caro: 333    (suma exacta: 1000)
```

El resto se asigna a los primeros participantes **ordenados por id**, no por orden de llegada. Eso hace que el mismo gasto se divida siempre igual, en cualquier dispositivo: los saldos no cambian según cómo llegaron los datos.

También hay una sutileza en el parseo. `Math.round(Number('1.005') * 100)` devuelve `100`, no `101`, porque 1.005 se representa como 1.00499999999999989. [`parseMoneyToMinor`](shared/money.ts) trabaja sobre los dígitos como texto y nunca multiplica un float. Ese caso lo encontró un test.

Detalle relacionado: no todas las monedas tienen dos decimales. El yen, el peso chileno y el colombiano no tienen unidad menor, así que cada moneda declara sus `decimals` y el formateo los respeta. Sin eso, ¥1000 se mostraría como ¥10,00.

### 2. La liquidación es un greedy acotado, y está bien que lo sea

Encontrar el mínimo absoluto de transferencias para saldar un grupo es NP-hard. [`settle`](shared/settlement.ts) usa una heurística greedy: el que más debe le paga al que más le deben, y se repite.

No garantiza el óptimo absoluto, pero **garantiza como máximo n-1 transferencias**, porque cada paso salda por completo al menos a una de las dos personas. Para grupos de viaje reales —menos de 20 personas— el resultado es óptimo o queda a una transferencia del óptimo. La invariante que sí se verifica es que las transferencias saldan **exactamente** todos los saldos, con un test que aplica el resultado sobre los saldos y comprueba que todos queden en cero, incluido un barrido de 200 escenarios pseudoaleatorios con semilla fija.

### 3. Grupos por código, sin tabla de usuarios

La alternativa era registro con email u OAuth. La descarté porque el momento de uso es "estamos seis en un bar y hay que cargar la cena": pedir que cinco personas creen una cuenta ahí mismo mata el producto.

El modelo es el de un documento compartido: **el código es la llave**. Quien crea el grupo puede además ponerle un PIN, que se guarda como hash PBKDF2-SHA256 con salt (100.000 iteraciones) y se canjea por un token firmado con HMAC-SHA256.

El token es deliberadamente **no** un JWT completo: no hay negociación de algoritmos, y fijar HMAC-SHA256 elimina de raíz toda la familia de ataques de confusión de `alg`. Lleva el id del grupo, y el servidor compara ese id contra el de la URL en cada request — eso es lo que evita que una sesión válida para un grupo sirva para escribir en otro. Hay un test end-to-end sólo para eso.

Es un modelo con un límite claro y consciente: **cualquiera con el link puede editar**. No hay permisos por persona ni historial de quién cargó qué. Para un grupo de amigos que ya se conocen, es el nivel de ceremonia correcto; para algo más, haría falta el modelo de cuentas.

### 4. Un solo Worker sirve la API y el frontend

El prototipo tenía el HTML en Cloudflare Pages y la API en un Worker aparte, con `Access-Control-Allow-Origin: "*"` para que se hablaran.

Ahora un único Worker sirve los assets estáticos y responde `/api/*`. Al compartir origen no hay CORS, ni preflight, ni dos dominios que mantener sincronizados, ni un `ALLOWED_ORIGIN` que se olvida de actualizar. Un `wrangler deploy` publica todo.

El contrato entre los dos lados vive en [`shared/`](shared/), fuera de `web/` y de `api/`: los tipos, los límites de validación y la lógica de dominio se definen una sola vez. Si cambia la forma de un payload, el frontend deja de compilar.

---

## Arquitectura

```
┌──────────────────────────────────────────────────┐
│  Cloudflare Worker  (cuentas-claras)             │
│                                                  │
│  /api/*  ──────────────►  router → validación    │
│                              │      → repo       │
│                              ▼                   │
│                         D1 (SQLite)              │
│                                                  │
│  todo lo demás  ──────►  assets estáticos        │
│                          (SPA de React)          │
└──────────────────────────────────────────────────┘
```

```
shared/           Contrato y dominio: usado por ambos lados
  types.ts          DTOs y límites de validación
  settlement.ts     Saldos y liquidación   ← el núcleo
  money.ts          Parseo y formateo de dinero
  categories.ts     Inferencia por keywords
  currencies.ts     Catálogo de monedas
  colors.ts         Paleta e iniciales de avatares

api/              Cloudflare Worker
  src/index.ts      Router y handlers
  src/repo.ts       Todas las queries a D1
  src/validate.ts   Validación de entrada
  src/crypto.ts     Códigos, PIN (PBKDF2), tokens (HMAC)
  src/http.ts       Respuestas y errores
  schema.sql        Esquema de la base

web/              SPA de React
  src/components/   UI
  src/hooks/        useGroup: estado, sesión y mutaciones
  src/lib/          Cliente HTTP, sesión, fechas, formateo
```

### Modelo de datos

```sql
groups   (id, code UNIQUE, name, currency,
          secondary_currency, secondary_rate,
          pin_hash, pin_salt, created_at, updated_at)

members  (id, group_id → groups, name, color, sort_order)

expenses (id, group_id → groups, description, amount_cents,
          spent_on, payer_id → members, category, created_at)

expense_participants (expense_id → expenses, member_id → members)
```

Dos detalles con intención:

- **`ON DELETE CASCADE` desde `groups`**, así borrar un grupo no deja filas huérfanas.
- **`ON DELETE RESTRICT` en `expenses.payer_id`**: no se puede eliminar a alguien que pagó gastos. La API lo valida antes para devolver un mensaje que explique el motivo en lugar de un error de constraint. Es lo que impide que los saldos queden descuadrados por un borrado.

El snapshot completo de un grupo se arma con **tres queries fijas** —integrantes, gastos y participantes— y se une en memoria, sin importar cuántos gastos tenga. Nada de N+1.

---

## Correr el proyecto

Requiere Node 20, 22 o 24.

```bash
git clone https://github.com/juancreynoso/cuentas-claras.git
cd cuentas-claras
npm install

# Base local y secreto de desarrollo
npm run db:init
cp api/.dev.vars.example api/.dev.vars   # y poné un valor al azar en SESSION_SECRET

npm run dev        # Vite en :5173 + Worker en :8787
```

`npm run dev:web` levanta sólo el frontend, que hace proxy de `/api` al Worker.

### Comandos

| Comando              | Qué hace                             |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Frontend y Worker juntos             |
| `npm test`           | Los 89 tests                         |
| `npm run test:watch` | Tests en modo watch                  |
| `npm run typecheck`  | `tsc --noEmit` en los dos workspaces |
| `npm run lint`       | ESLint con información de tipos      |
| `npm run format`     | Prettier sobre todo el repo          |
| `npm run verify`     | Todo lo anterior, como en CI         |
| `npm run build`      | Build de producción del frontend     |

### Deploy

```bash
cd api

# 1. Crear la base y pegar el database_id que imprime en wrangler.toml
npm run db:create

# 2. Aplicar el esquema en remoto
npm run db:init:remote

# 3. Secreto de sesión (32+ caracteres al azar)
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET

# 4. Publicar frontend y Worker
cd .. && npm run deploy
```

---

## Tests

89 tests, concentrados donde un error cuesta plata:

```
shared/settlement.test.ts    Reparto exacto, invariante de suma cero,
                             cota de n-1 transferencias, 200 escenarios al azar
shared/money.test.ts         Parseo con coma y punto, redondeo, ida y vuelta,
                             monedas sin decimales
shared/categories.test.ts    Inferencia, tildes, palabras completas, override
shared/colors.test.ts        Iniciales con acentos, emoji y nombres raros
web/src/lib/dates.test.ts    Fecha local vs UTC
web/src/components/          ExpenseSheet: validación, reparto en vivo,
  ExpenseSheet.test.tsx      confirmación de borrado
```

Además hay un [script end-to-end](scripts/e2e.sh) que corre 27 verificaciones contra un Worker local: autorización, aislamiento entre grupos, verificación de PIN, validaciones y ruteo del SPA.

Dos bugs reales salieron de escribir estos tests: el redondeo de `1.005`, y `farmacia` clasificando como _compras_ en lugar de _salud_ porque esa categoría se evaluaba antes.

---

## Accesibilidad

- Los paneles inferiores son diálogos modales de verdad: `role="dialog"`, `aria-modal`, cierran con Escape, atrapan el Tab y devuelven el foco al elemento que los abrió.
- Todo control tiene nombre accesible; los avatares de participantes anuncian su estado (`aria-pressed`, "incluido"/"excluido").
- Foco visible en todos los elementos interactivos.
- Se respeta `prefers-reduced-motion`.
- El color nunca es el único portador de información: los saldos dicen "debe" o "le deben" además de cambiar de color.

---

## Límites conocidos

Cosas que faltan, a conciencia:

- **Sin rate limiting.** El PBKDF2 de 100.000 iteraciones encarece cada intento de PIN, y hay que conocer el código de 6 caracteres antes de poder probar. Aun así, lo correcto sería sumar el binding de rate limiting de Cloudflare en `/session`. Es lo primero de la lista.
- **Última escritura gana.** Si dos personas editan el mismo gasto a la vez, queda la última. Hace falta un `updated_at` por gasto y detección de conflicto.
- **Sin realtime.** Los cambios de los demás aparecen al recargar. Un Durable Object por grupo con WebSockets lo resolvería.
- **Cotizaciones a mano.** No hay API de tipo de cambio; el grupo fija la suya. Es predecible, pero se desactualiza.
- **Cada mutación relee todo el grupo.** Es un round-trip extra a cambio de no tener estado divergente nunca. Con miles de gastos habría que pasar a updates incrementales.
- **Sólo español.** La interfaz no está internacionalizada, aunque la inferencia de categorías entiende keywords en inglés.

---

## Stack

React 19 · TypeScript · Vite 8 · Tailwind 4 · Cloudflare Workers · D1 (SQLite) · Vitest · ESLint · GitHub Actions

Sin librería de estado, sin librería de datos, sin componentes de terceros: el proyecto es lo bastante chico como para que las dependencias cuesten más de lo que aportan.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
