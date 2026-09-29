#!/usr/bin/env bash
# Starts a LOCAL FollowUp with every outside key blanked, runs the robot
# against it, and stops it again. Usage, from followup/:
#   LOCAL_ENV=/path/to/local.env bash scripts/robot/run.sh
# LOCAL_ENV must set DATABASE_URL (and DIRECT_URL) to a localhost database,
# plus NEXTAUTH_SECRET and NEXTAUTH_URL. Nothing else is needed.
set -euo pipefail
cd "$(dirname "$0")/../.."

: "${LOCAL_ENV:?set LOCAL_ENV to the local env file}"
set -a
# shellcheck disable=SC1090
source "$LOCAL_ENV"
set +a
case "${DATABASE_URL:-}" in *localhost*) ;; *) echo "refusing: DATABASE_URL is not a local database" >&2; exit 1 ;; esac

# Next.js also reads followup/.env, which holds live keys. A variable that is
# already set, even to an empty string, wins over .env, so every key the app
# reads (except the local database and sign-in secret) is set empty here:
# no real email, text, payment or AI call can leave a robot run.
for key in $(grep -rhoE "process\.env\.[A-Z0-9_]+" src next.config.ts | sed 's/process.env.//' | sort -u); do
  case "$key" in DATABASE_URL|DIRECT_URL|NEXTAUTH_SECRET|NEXTAUTH_URL|NODE_ENV|NEXT_RUNTIME) continue ;; esac
  export "$key="
done

PORT="${ROBOT_PORT:-3111}"
export ROBOT_BASE_URL="http://localhost:$PORT"
npx prisma migrate deploy >/dev/null
npx next dev -p "$PORT" >"${ROBOT_LOG:-/tmp/robot-dev.log}" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 120); do
  curl -s -o /dev/null "$ROBOT_BASE_URL/signin" && break
  sleep 2
done
node scripts/robot/robot.mjs
