#!/usr/bin/env bash
# Veilig uitrollen naar de VPS: alleen een gepushte commit waarvan de tests op GitHub groen zijn,
# daarna git pull + installeren/bouwen + pm2 herstarten, en controleren of de site antwoordt.
# Antwoordt de site niet, dan wordt automatisch teruggedraaid naar de vorige commit.
#
# Gebruik (vanuit de repo, op je eigen computer; vereist ssh en de GitHub CLI `gh`):
#   bash deploy/deploy.sh <pm2-naam> <map-op-de-vps> <gezondheids-url> ["bouwcommando op de vps"]
# Voorbeeld:
#   bash deploy/deploy.sh buitengoed /home/micha/buitengoed-app https://buitengoed.luyens.be/ "cd server && npm ci --omit=dev && cd ../client && npm ci && npm run build"
# Zonder bouwcommando: `npm ci --omit=dev` in de hoofdmap.
# Omgevingsvariabelen: VPS (standaard root@89.116.24.53), CI_WAIT_MIN (standaard 10), SKIP_CI=1 (enkel als de repo geen tests heeft).
set -euo pipefail

NAME="${1:?pm2-naam ontbreekt}"; DIR="${2:?map op de vps ontbreekt}"; HEALTH="${3:?gezondheids-url ontbreekt}"
BUILD="${4:-npm ci --omit=dev}"
VPS="${VPS:-root@89.116.24.53}"
CI_WAIT_MIN="${CI_WAIT_MIN:-10}"

cd "$(dirname "$0")/.."
red() { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }
ok() { printf '\033[0;32m%s\033[0m\n' "$*"; }

# 1. Lokaal: alles gecommit en gepusht?
git diff --quiet && git diff --cached --quiet || { red "Er zijn niet-gecommitte wijzigingen. Commit en push eerst."; exit 1; }
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin "$BRANCH"
SHA="$(git rev-parse HEAD)"
[ "$SHA" = "$(git rev-parse "origin/$BRANCH")" ] || { red "Lokale commit staat niet op GitHub (git push eerst)."; exit 1; }

# 2. Tests op GitHub moeten groen zijn voor precies deze commit.
if [ "${SKIP_CI:-0}" != "1" ]; then
  echo "Wachten op de tests van ${SHA:0:7} (maximaal ${CI_WAIT_MIN} min)..."
  GREEN=0
  for _ in $(seq 1 $((CI_WAIT_MIN * 6))); do
    RUNS="$(gh run list --commit "$SHA" --json status,conclusion --jq '.[] | "\(.status):\(.conclusion)"' 2>/dev/null || true)"
    if echo "$RUNS" | grep -qE 'completed:(failure|cancelled|timed_out|startup_failure)'; then red "Tests mislukt voor deze commit. Niet uitgerold."; exit 1; fi
    # Klaar = er is minstens één run en alle runs zijn geslaagd of overgeslagen.
    if [ -n "$RUNS" ] && ! echo "$RUNS" | grep -qvE '^completed:(success|skipped)$'; then GREEN=1; break; fi
    sleep 10
  done
  [ "$GREEN" = 1 ] || { red "Tests niet op tijd groen, of er zijn geen tests gevonden. Niet uitgerold."; exit 1; }
  ok "Tests groen."
fi

# 3. Op de VPS: bijwerken, bouwen, herstarten, controleren, zo nodig terugdraaien.
# ssh plakt argumenten aan elkaar zonder aanhalingstekens; %q beschermt spaties (bv. in het bouwcommando).
ssh "$VPS" "bash -s -- $(printf '%q ' "$NAME" "$DIR" "$HEALTH" "$BUILD")" <<'REMOTE'
set -uo pipefail
NAME="$1"; DIR="$2"; HEALTH="$3"; BUILD="$4"
cd "$DIR"
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Er staan lokale wijzigingen op de VPS in $DIR. Niet uitgerold." >&2; exit 2; }
PREV="$(git rev-parse HEAD)"
git pull --ff-only -q || { echo "git pull mislukt." >&2; exit 2; }
NEW="$(git rev-parse HEAD)"
healthy() { for _ in $(seq 1 15); do curl -fsS -o /dev/null --max-time 5 "$HEALTH" && return 0; sleep 2; done; return 1; }
deploy() { bash -c "$BUILD" >/dev/null 2>&1 && pm2 restart "$NAME" --update-env >/dev/null && sleep 3 && healthy; }
if [ "$PREV" = "$NEW" ]; then echo "Al up-to-date (${NEW:0:7}); ik herstart niet."; healthy && exit 0 || exit 3; fi
if deploy; then echo "Uitgerold: ${PREV:0:7} -> ${NEW:0:7}. Site antwoordt."; exit 0; fi
echo "De site antwoordt niet na de uitrol van ${NEW:0:7}. Terugdraaien naar ${PREV:0:7}..." >&2
git reset --hard -q "$PREV"
if deploy; then echo "Teruggedraaid naar ${PREV:0:7}; de site antwoordt weer." >&2; exit 4; fi
echo "Ook na het terugdraaien antwoordt de site niet. Kijk met: pm2 logs $NAME" >&2; exit 5
REMOTE
