#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECOSYSTEM_FILE="/etc/tarot/ecosystem.config.js"

if [[ ! -r "$ECOSYSTEM_FILE" ]]; then
  echo "error: cannot read $ECOSYSTEM_FILE" >&2
  echo "expected root:veikko 640 so the pm2 user can read it but nobody else can" >&2
  exit 1
fi

# Read the port from the ecosystem file so the health check always matches
# what pm2 actually started (fallback 4201 if the file doesn't set one).
PORT="$(node -p "const c = require(process.argv[1]); (c.apps && c.apps[0] && c.apps[0].env && c.apps[0].env.PORT) || 4201" "$ECOSYSTEM_FILE")"

echo "==> Pulling latest changes..."
git -C "$REPO_DIR" pull

echo "==> Installing dependencies..."
cd "$REPO_DIR" && npm ci

echo "==> Starting/restarting tarot under pm2 (secrets come from $ECOSYSTEM_FILE)..."
pm2 startOrRestart "$ECOSYSTEM_FILE"
pm2 save

echo "==> Waiting for http://127.0.0.1:${PORT}/ ..."
ready=false
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

if [[ "$ready" != true ]]; then
  echo "error: tarot did not become ready on 127.0.0.1:${PORT}; last logs:" >&2
  pm2 logs tarot --lines 20 --nostream >&2 || true
  exit 1
fi

echo "==> Done. tarot is up on 127.0.0.1:${PORT} (public traffic goes through the reverse proxy)."
