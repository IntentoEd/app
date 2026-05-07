#!/usr/bin/env bash
# Deploy do Apps Script em prod. Requer clasp já autenticado (~/.clasprc.json).
#
# Uso:
#   ./scripts/deploy-gas.sh                  # descrição auto = vYYMMDD-HHMM
#   ./scripts/deploy-gas.sh "fix authz EM"   # descrição custom
#
# Bloqueia se houver mudança não-commitada em gas/ — força commit antes,
# pra que o git seja a fonte da verdade do que está em prod.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAS_DIR="$ROOT/gas"
DEPLOYMENT_ID="AKfycbymrGWq2BYRu1FZTmWagh9NtII6bhVEoZ2fd63x1IVqm43mz7b7NK23k1XCyxuFONPL0g"

# 1) Sanity: gas/ existe e tem .clasp.json
[ -d "$GAS_DIR" ] || { echo "✗ pasta $GAS_DIR não existe"; exit 1; }
[ -f "$GAS_DIR/.clasp.json" ] || { echo "✗ $GAS_DIR/.clasp.json ausente — clasp não inicializado"; exit 1; }

# 2) Bloqueia se houver mudança não-commitada em gas/
SUJO="$(git -C "$ROOT" status --porcelain -- gas/)"
if [ -n "$SUJO" ]; then
  echo "✗ gas/ tem mudanças não-commitadas — commit antes de deployar:"
  echo "$SUJO"
  exit 1
fi

# 3) Descrição do deploy
DESC="${1:-v$(date +%y%m%d-%H%M)}"

# 4) Push HEAD pro Apps Script
echo "→ clasp push (gas/ → Apps Script HEAD)"
( cd "$GAS_DIR" && npx -y @google/clasp@latest push --force )

# 5) Deploy versionado em prod
echo "→ clasp deploy ($DESC)"
( cd "$GAS_DIR" && npx -y @google/clasp@latest deploy -i "$DEPLOYMENT_ID" -d "$DESC" )

echo "✓ deploy ok — rode smokeTest() no editor pra validar"
