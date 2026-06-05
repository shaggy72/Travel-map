#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Install and start Travel Map on a Debian / Ubuntu / Mint server.
#
# First time:  bash deploy.sh          (installs everything, starts the app)
# To update:   bash deploy.sh          (pulls latest code, rebuilds, restarts)
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
  echo ""
  warn ".env was missing — a template has been created."
  echo ""
  echo "   Fill in your secrets now:"
  echo "   nano $APP_DIR/.env"
  echo ""
  echo "   Required:"
  echo "     MAPBOX_TOKEN=your_token_here"
  echo ""
  echo "   Recommended:"
  echo "     APP_USERNAME=yourname"
  echo "     APP_PASSWORD=yourpassword"
  echo "     MAPBOX_STYLE=username/styleId   (or leave blank for default)"
  echo ""
  echo "   Then re-run:  bash $APP_DIR/deploy.sh"
  exit 0
fi
ok ".env present"

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
sudo apt-get install -y --no-install-recommends \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2
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
echo "To update the app in the future, just run:"
echo "  bash $APP_DIR/deploy.sh"
echo ""
