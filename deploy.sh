#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Install and start Travel Map on a Debian / Ubuntu / Mint server.
#
# First time:  bash deploy.sh
# To update:   bash deploy.sh          (pulls latest code, rebuilds, restarts)
#
# Env vars can be passed inline to skip the .env prompt on first run:
#   MAPBOX_TOKEN=pk.xxx APP_USERNAME=micha APP_PASSWORD=secret bash deploy.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
step() { echo -e "\n${BOLD}▶  $*${NC}"; }
die()  { echo -e "${RED}✗  $*${NC}" >&2; exit 1; }

REPO_URL="https://github.com/shaggy72/Travel-map.git"
APP_DIR="$HOME/Travel-map"
APP_NAME="travel-map"

echo ""
echo -e "${BOLD}🗺️  Travel Map — server deployment${NC}"
echo "======================================"

# ── 0. Passwordless sudo check ────────────────────────────────────────────────
# The script calls sudo non-interactively (apt-get, npm install -g, pm2 startup).
# This silently fails if sudo requires a password — check up front.
step "Sudo access"
if ! sudo -n true 2>/dev/null; then
  die "This script requires passwordless sudo.
   Run this once, then re-run deploy.sh:

   echo '$USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/\$USER"
fi
ok "Passwordless sudo available"

# ── 1. Node.js ≥ 18 ──────────────────────────────────────────────────────────
step "Node.js"
NODE_OK=false
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  [[ "$NODE_MAJOR" -ge 18 ]] && NODE_OK=true
fi
if ! $NODE_OK; then
  warn "Node.js 18+ not found — installing via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
ok "Node.js $(node -v)"

# ── 2. PM2 ────────────────────────────────────────────────────────────────────
step "PM2"
if ! command -v pm2 &>/dev/null; then
  warn "PM2 not found — installing..."
  sudo npm install -g pm2
fi
ok "PM2 $(pm2 -v)"

# ── 3. Clone or update the repo ───────────────────────────────────────────────
step "Repository"
if [ -d "$APP_DIR/.git" ]; then
  echo "Pulling latest changes..."
  git -C "$APP_DIR" pull --ff-only
  ok "Repo updated"
else
  echo "Cloning from GitHub..."
  git clone "$REPO_URL" "$APP_DIR"
  ok "Repo cloned to $APP_DIR"
fi

cd "$APP_DIR"

# ── 4. .env ───────────────────────────────────────────────────────────────────
step ".env"
if [ ! -f ".env" ]; then
  cp .env.example .env

  # Seed from environment variables if passed inline (e.g. MAPBOX_TOKEN=pk.xxx bash deploy.sh)
  # This allows a fully automated first deployment without a second run.
  [ -n "${MAPBOX_TOKEN:-}" ]  && sed -i "s|MAPBOX_TOKEN=.*|MAPBOX_TOKEN=${MAPBOX_TOKEN}|"   .env
  [ -n "${MAPBOX_STYLE:-}" ]  && sed -i "s|MAPBOX_STYLE=.*|MAPBOX_STYLE=${MAPBOX_STYLE}|"   .env
  [ -n "${APP_USERNAME:-}" ]  && sed -i "s|APP_USERNAME=.*|APP_USERNAME=${APP_USERNAME}|"   .env
  [ -n "${APP_PASSWORD:-}" ]  && sed -i "s|APP_PASSWORD=.*|APP_PASSWORD=${APP_PASSWORD}|"   .env
  [ -n "${PORT:-}" ]          && sed -i "s|PORT=.*|PORT=${PORT}|"                           .env

  warn ".env created from template."
fi

# MAPBOX_TOKEN is required — abort if still a placeholder
if grep -q "^MAPBOX_TOKEN=your_mapbox_token_here" .env 2>/dev/null || \
   ! grep -qE "^MAPBOX_TOKEN=.+" .env 2>/dev/null; then
  echo ""
  warn "MAPBOX_TOKEN is not set in .env."
  echo ""
  echo "   Option A — edit the file:"
  echo "     nano $APP_DIR/.env"
  echo "     bash $APP_DIR/deploy.sh"
  echo ""
  echo "   Option B — pass it inline:"
  echo "     MAPBOX_TOKEN=pk.xxx APP_USERNAME=you APP_PASSWORD=secret bash $APP_DIR/deploy.sh"
  exit 0
fi
ok ".env ready"

# ── 5. Install npm dependencies ───────────────────────────────────────────────
step "npm install"
npm install
ok "Dependencies installed"

# ── 6. Build the webapp ───────────────────────────────────────────────────────
step "Build webapp"
npm run build:webapp
ok "Webapp built → webapp/dist"

# ── 7. Remotion browser system libraries ─────────────────────────────────────
step "Remotion browser"
echo "Installing system libraries..."

# Ubuntu 24.04+ renamed several packages with a t64 suffix (64-bit time_t transition).
# Detect which variant exists and install the right one.
resolve_pkg() {
  # If the t64 variant exists in apt cache, use it; otherwise use the plain name.
  apt-cache show "${1}t64" &>/dev/null 2>&1 && echo "${1}t64" || echo "$1"
}

sudo apt-get install -y --no-install-recommends \
  libnss3 \
  "$(resolve_pkg libatk1.0-0)" \
  libatk-bridge2.0-0 \
  "$(resolve_pkg libcups2)" \
  "$(resolve_pkg libdrm2)" \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  "$(resolve_pkg libgbm1)" \
  "$(resolve_pkg libasound2)"

echo "Downloading headless browser (first run only, ~150 MB)..."
npx remotion browser ensure
ok "Remotion browser ready"

# ── 8. Start or restart the app with PM2 ─────────────────────────────────────
step "PM2 process"
if pm2 list --no-color 2>/dev/null | grep -q "$APP_NAME"; then
  pm2 restart "$APP_NAME"
  ok "App restarted"
else
  pm2 start server/index.cjs --name "$APP_NAME"
  ok "App started"
fi
pm2 save --force

# ── 9. Auto-start PM2 on reboot ───────────────────────────────────────────────
step "Auto-start on reboot"
STARTUP_CMD=$(pm2 startup 2>&1 | grep "sudo env" || true)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD"
  pm2 save --force
  ok "PM2 will auto-start after reboot"
else
  ok "PM2 auto-start already configured"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✈  Travel Map is live!                      ║${NC}"
echo -e "${GREEN}${BOLD}║     http://${SERVER_IP}:3002             ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "To update the app in the future:"
echo "  bash $APP_DIR/deploy.sh"
echo ""
