#!/usr/bin/env bash
# BHD Pro — Cloud Agent start (per-boot reconciliation).
# Starts PostgreSQL + Redis, ensures the dev role/database exist, applies the
# schema and seeds demo data. Idempotent and safe to re-run. The API and web
# dev servers run as `terminals`, not here.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n=== %s ===\n' "$1"; }

# Serialize concurrent invocations (this may run both as the `start` phase and
# from the backend terminal); the lock makes the whole script safe to re-run.
exec 9>/tmp/bhd-start.lock
flock 9

# Node 24 on PATH.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
NODE24_BIN="$(ls -d "$HOME"/.nvm/versions/node/v24* 2>/dev/null | sort -V | tail -1)/bin"
[ -d "$NODE24_BIN" ] && export PATH="$NODE24_BIN:$PATH"

# ---------------------------------------------------------------------------
# PostgreSQL 16 (started via pg_ctlcluster; systemd is not the init here).
# ---------------------------------------------------------------------------
log "Starting PostgreSQL"
if ! sudo pg_lsclusters -h 2>/dev/null | grep -q ' online '; then
  sudo pg_ctlcluster 16 main start
fi
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done
sudo -u postgres pg_isready

# ---------------------------------------------------------------------------
# Redis.
# ---------------------------------------------------------------------------
log "Starting Redis"
if ! redis-cli ping >/dev/null 2>&1; then
  sudo redis-server /etc/redis/redis.conf --daemonize yes
  sleep 1
fi
redis-cli ping

# ---------------------------------------------------------------------------
# Dev role + database (idempotent).
# ---------------------------------------------------------------------------
log "Ensuring database role and schema"
sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='qootk') THEN
    CREATE ROLE qootk LOGIN PASSWORD 'qootk_secret';
  END IF;
END $$;
SQL
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='qootk_pro'" | grep -q 1; then
  sudo -u postgres createdb -O qootk qootk_pro
fi

# ---------------------------------------------------------------------------
# Schema + demo seed (both idempotent).
# ---------------------------------------------------------------------------
( cd backend && npx prisma db push --skip-generate && npm run prisma:seed )

log "start.sh complete — API/web run in their terminals"
