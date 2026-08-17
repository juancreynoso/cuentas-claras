#!/usr/bin/env bash
#
# Verificación end-to-end de la API contra un Worker local.
#
# Cubre lo que los tests unitarios no pueden: autorización real, aislamiento
# entre grupos, verificación del PIN contra la base y ruteo del SPA.
#
# Uso:
#   npm run db:init --workspace=api     # base local con el esquema aplicado
#   npm run dev:api                     # Worker en :8787
#   bash scripts/e2e.sh
#
set -u
API=http://localhost:8787/api
pass=0; fail=0
check() { # check <desc> <condition-result>
  if [ "$2" = "1" ]; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1"; fail=$((fail+1)); fi
}
j() { node -e "let r='';process.stdin.on('data',d=>r+=d).on('end',()=>{try{const o=JSON.parse(r);const v=$1;console.log(v===undefined?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR')}})"; }

echo "── health ──"
H=$(curl -s $API/health)
check "responde ok" "$([ "$(echo "$H" | j 'o.ok')" = "true" ] && echo 1 || echo 0)"

echo "── crear grupo (sin PIN) ──"
CREATE=$(curl -s -X POST $API/groups -H 'Content-Type: application/json' \
  -d '{"name":"Europa 2026","currency":"EUR","secondaryCurrency":"USD","secondaryRate":1.16,"memberNames":["Hernan","Andrea","Juan Cruz"]}')
CODE=$(echo "$CREATE" | j 'o.group.code')
TOKEN=$(echo "$CREATE" | j 'o.token')
check "devuelve codigo de 6 chars" "$([ ${#CODE} -eq 6 ] && echo 1 || echo 0)"
check "devuelve token" "$([ -n "$TOKEN" ] && echo 1 || echo 0)"
check "crea 3 integrantes" "$([ "$(echo "$CREATE" | j 'o.snapshot.members.length')" = "3" ] && echo 1 || echo 0)"
check "asigna colores distintos" "$([ "$(echo "$CREATE" | j 'new Set(o.snapshot.members.map(m=>m.color)).size')" = "3" ] && echo 1 || echo 0)"
check "no expone hash de PIN" "$(echo "$CREATE" | grep -qi 'pin_hash\|pinHash' && echo 0 || echo 1)"
echo "     codigo: $CODE"

M1=$(echo "$CREATE" | j 'o.snapshot.members[0].id')
M2=$(echo "$CREATE" | j 'o.snapshot.members[1].id')
M3=$(echo "$CREATE" | j 'o.snapshot.members[2].id')

echo "── autorizacion ──"
NOAUTH=$(curl -s -o /dev/null -w '%{http_code}' $API/groups/$CODE)
check "GET sin token da 401" "$([ "$NOAUTH" = "401" ] && echo 1 || echo 0)"
BADTOK=$(curl -s -o /dev/null -w '%{http_code}' $API/groups/$CODE -H "Authorization: Bearer aaa.bbb")
check "token invalido da 401" "$([ "$BADTOK" = "401" ] && echo 1 || echo 0)"

echo "── crear gasto ──"
EXP=$(curl -s -X POST $API/groups/$CODE/expenses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"description\":\"Cena en el puerto\",\"amountCents\":10000,\"spentOn\":\"2026-03-28\",\"payerId\":\"$M1\",\"participantIds\":[\"$M1\",\"$M2\",\"$M3\"]}")
EXPID=$(echo "$EXP" | j 'o.id')
check "crea el gasto" "$([ -n "$EXPID" ] && echo 1 || echo 0)"

SNAP=$(curl -s $API/groups/$CODE -H "Authorization: Bearer $TOKEN")
check "el snapshot trae 1 gasto" "$([ "$(echo "$SNAP" | j 'o.expenses.length')" = "1" ] && echo 1 || echo 0)"
check "trae los 3 participantes" "$([ "$(echo "$SNAP" | j 'o.expenses[0].participantIds.length')" = "3" ] && echo 1 || echo 0)"
check "guarda centavos enteros" "$([ "$(echo "$SNAP" | j 'o.expenses[0].amountCents')" = "10000" ] && echo 1 || echo 0)"

echo "── validaciones ──"
V1=$(curl -s -X POST $API/groups/$CODE/expenses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"description\":\"\",\"amountCents\":100,\"spentOn\":\"2026-03-28\",\"payerId\":\"$M1\",\"participantIds\":[\"$M1\"]}" -o /dev/null -w '%{http_code}')
check "rechaza descripcion vacia" "$([ "$V1" = "400" ] && echo 1 || echo 0)"
V2=$(curl -s -X POST $API/groups/$CODE/expenses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"description\":\"x\",\"amountCents\":-5,\"spentOn\":\"2026-03-28\",\"payerId\":\"$M1\",\"participantIds\":[\"$M1\"]}" -o /dev/null -w '%{http_code}')
check "rechaza monto negativo" "$([ "$V2" = "400" ] && echo 1 || echo 0)"
V3=$(curl -s -X POST $API/groups/$CODE/expenses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"description\":\"x\",\"amountCents\":100,\"spentOn\":\"2026-02-31\",\"payerId\":\"$M1\",\"participantIds\":[\"$M1\"]}" -o /dev/null -w '%{http_code}')
check "rechaza fecha inexistente (31 feb)" "$([ "$V3" = "400" ] && echo 1 || echo 0)"
V4=$(curl -s -X POST $API/groups/$CODE/expenses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"description\":\"x\",\"amountCents\":100,\"spentOn\":\"2026-03-28\",\"payerId\":\"intruso\",\"participantIds\":[\"$M1\"]}" -o /dev/null -w '%{http_code}')
check "rechaza pagador ajeno al grupo" "$([ "$V4" = "400" ] && echo 1 || echo 0)"
V5=$(curl -s -X POST $API/groups -H 'Content-Type: application/json' -d '{"name":"x","currency":"EUR","memberNames":["Ana","ana"]}' -o /dev/null -w '%{http_code}')
check "rechaza integrantes duplicados" "$([ "$V5" = "400" ] && echo 1 || echo 0)"
V6=$(curl -s -X POST $API/groups -H 'Content-Type: application/json' -d '{"name":"x","currency":"XYZ","memberNames":["Ana","Beto"]}' -o /dev/null -w '%{http_code}')
check "rechaza moneda invalida" "$([ "$V6" = "400" ] && echo 1 || echo 0)"

echo "── borrar integrante con gastos ──"
DEL=$(curl -s -X DELETE $API/groups/$CODE/members/$M1 -H "Authorization: Bearer $TOKEN")
check "bloquea borrar a quien pago" "$([ "$(echo "$DEL" | j 'o.code')" = "member_has_expenses" ] && echo 1 || echo 0)"

echo "── grupo con PIN ──"
P=$(curl -s -X POST $API/groups -H 'Content-Type: application/json' \
  -d '{"name":"Con PIN","currency":"ARS","pin":"1234","memberNames":["Ana","Beto"]}')
PCODE=$(echo "$P" | j 'o.group.code')
check "marca hasPin" "$([ "$(echo "$P" | j 'o.group.hasPin')" = "true" ] && echo 1 || echo 0)"
S1=$(curl -s -X POST $API/groups/$PCODE/session -H 'Content-Type: application/json' -d '{}')
check "sin PIN pide PIN (403)" "$([ "$(echo "$S1" | j 'o.code')" = "pin_required" ] && echo 1 || echo 0)"
S2=$(curl -s -X POST $API/groups/$PCODE/session -H 'Content-Type: application/json' -d '{"pin":"9999"}')
check "PIN incorrecto es rechazado" "$([ "$(echo "$S2" | j 'o.code')" = "wrong_pin" ] && echo 1 || echo 0)"
S3=$(curl -s -X POST $API/groups/$PCODE/session -H 'Content-Type: application/json' -d '{"pin":"1234"}')
check "PIN correcto devuelve token" "$([ -n "$(echo "$S3" | j 'o.token')" ] && echo 1 || echo 0)"

echo "── aislamiento entre grupos ──"
PTOKEN=$(echo "$S3" | j 'o.token')
CROSS=$(curl -s -o /dev/null -w '%{http_code}' $API/groups/$CODE -H "Authorization: Bearer $PTOKEN")
check "token de un grupo no sirve en otro" "$([ "$CROSS" = "401" ] && echo 1 || echo 0)"

echo "── grupo inexistente ──"
NF=$(curl -s -X POST $API/groups/ZZZZZZ/session -H 'Content-Type: application/json' -d '{}')
check "devuelve group_not_found" "$([ "$(echo "$NF" | j 'o.code')" = "group_not_found" ] && echo 1 || echo 0)"

echo "── borrar grupo completo ──"
D=$(curl -s -X POST $API/groups -H 'Content-Type: application/json' \
  -d '{"name":"Descartable","currency":"EUR","memberNames":["Ana","Beto"]}')
DCODE=$(echo "$D" | j 'o.group.code')
DTOK=$(echo "$D" | j 'o.token')
DM1=$(echo "$D" | j 'o.snapshot.members[0].id')
DM2=$(echo "$D" | j 'o.snapshot.members[1].id')
curl -s -X POST $API/groups/$DCODE/expenses -H "Authorization: Bearer $DTOK" \
  -H 'Content-Type: application/json' \
  -d "{\"description\":\"Cena\",\"amountCents\":5000,\"spentOn\":\"2026-08-01\",\"payerId\":\"$DM1\",\"participantIds\":[\"$DM1\",\"$DM2\"]}" > /dev/null

DELNOAUTH=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $API/groups/$DCODE)
check "no se puede borrar sin token" "$([ "$DELNOAUTH" = "401" ] && echo 1 || echo 0)"

DEL=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $API/groups/$DCODE -H "Authorization: Bearer $DTOK")
check "borra un grupo que tiene gastos" "$([ "$DEL" = "200" ] && echo 1 || echo 0)"

GONE=$(curl -s -X POST $API/groups/$DCODE/session -H 'Content-Type: application/json' -d '{}' | j 'o.code')
check "el grupo borrado ya no existe" "$([ "$GONE" = "group_not_found" ] && echo 1 || echo 0)"

echo "── SPA ──"
ROOT=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8787/)
DEEP=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8787/g/ABC123)
check "sirve la raiz" "$([ "$ROOT" = "200" ] && echo 1 || echo 0)"
check "ruta profunda cae en el SPA" "$([ "$DEEP" = "200" ] && echo 1 || echo 0)"

echo ""
echo "RESULTADO: $pass ok, $fail fallidos"
[ $fail -eq 0 ] || exit 1
