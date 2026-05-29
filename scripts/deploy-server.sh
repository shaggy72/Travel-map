#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-server.sh — One-time server setup for Travel Map on Linux Mint
#
# Run as root (or with sudo) from the project directory:
#   chmod +x scripts/deploy-server.sh
#   sudo ./scripts/deploy-server.sh
#
# Before running:
#   1. DNS: Add A record  map.luyens.be → <your public IP>
#   2. Router: Port-forward 80 + 443 → this machine's local IP
#   3. Create .env from .env.example and set your credentials
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="map.luyens.be"
APP_PORT=3002
APP_DIR="$(pwd)"
APP_USER="${SUDO_USER:-$(whoami)}"

echo "======================================================"
echo " Travel Map — Server Setup"
echo " Domain : $DOMAIN"
echo " Dir    : $APP_DIR"
echo " User   : $APP_USER"
echo "======================================================"
echo ""

# ── 1. Node.js 20 ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(parseInt(process.version.slice(1)))')" -lt 20 ]]; then
  echo "[1/8] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[1/8] Node.js $(node --version) already installed ✓"
fi

# ── 2. Chromium (required by Remotion renderer) ────────────────────────────
echo "[2/8] Installing Chromium..."
apt-get install -y chromium-browser || apt-get install -y chromium || true
# Also let Remotion install its own bundled Chrome if needed
sudo -u "$APP_USER" npx remotion install-chrome 2>/dev/null || true
echo "      Chromium ready ✓"

# ── 3. npm dependencies ────────────────────────────────────────────────────
echo "[3/8] Installing npm dependencies..."
sudo -u "$APP_USER" npm ci
echo "      npm ci done ✓"

# ── 4. Generate gpxFiles.ts ────────────────────────────────────────────────
echo "[4/8] Generating gpxFiles.ts..."
sudo -u "$APP_USER" node scripts/syncGpxFiles.cjs
echo "      gpxFiles.ts generated ✓"

# ── 5. Build frontend ──────────────────────────────────────────────────────
echo "[5/8] Building React frontend..."
sudo -u "$APP_USER" npm run build:webapp
echo "      webapp/dist/ ready ✓"

# ── 6. PM2 ────────────────────────────────────────────────────────────────
echo "[6/8] Setting up PM2..."
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi
# Stop existing instance if any
sudo -u "$APP_USER" pm2 stop travel-map 2>/dev/null || true
sudo -u "$APP_USER" pm2 delete travel-map 2>/dev/null || true
# Start fresh
sudo -u "$APP_USER" pm2 start server/index.cjs --name travel-map --cwd "$APP_DIR"
echo "      PM2 started ✓"

# ── 7. nginx ──────────────────────────────────────────────────────────────
echo "[7/8] Configuring nginx..."
apt-get install -y nginx

cat > /etc/nginx/sites-available/travel-map << NGINX
server {
    listen 80;
    server_name $DOMAIN;

    # Certbot will edit this block to add HTTPS redirect
    location / {
        proxy_pass         http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;

        # Allow large GPX uploads and long render requests
        client_max_body_size 100m;
        proxy_read_timeout   600s;
        proxy_send_timeout   600s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/travel-map /etc/nginx/sites-enabled/travel-map
# Remove default site if it conflicts
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
echo "      nginx configured ✓"

# ── 8. SSL with Certbot ───────────────────────────────────────────────────
echo "[8/8] Obtaining SSL certificate..."
if ! command -v certbot &>/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
  --register-unsafely-without-email || {
  echo ""
  echo "[warn] Certbot failed — make sure DNS is pointing to this server and ports 80/443 are open."
  echo "       You can run manually later:  certbot --nginx -d $DOMAIN"
}

# ── PM2 auto-start on reboot ──────────────────────────────────────────────
sudo -u "$APP_USER" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true

echo ""
echo "======================================================"
echo " Setup complete!"
echo " Your app should be live at: https://$DOMAIN"
echo ""
echo " Useful commands:"
echo "   pm2 status          — check if app is running"
echo "   pm2 logs travel-map — view live logs"
echo "   pm2 restart travel-map — restart after config changes"
echo ""
echo " To update from GitHub:"
echo "   git pull && npm ci && npm run build:webapp && pm2 restart travel-map"
echo "======================================================"
