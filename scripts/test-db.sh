#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Only a dedicated throwaway local PostgreSQL container is accepted, never a remote URL.
container="civicpulse-policy-tests-${RANDOM}"
trap 'docker rm -fv "$container" >/dev/null 2>&1 || true' EXIT
# Unix socket only; no published ports, real passwords or production data.
docker run --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:16-alpine >/dev/null
ready=false
for attempt in {1..120}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then docker logs "$container"; exit 1; fi
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database/bootstrap.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  echo "Applying $(basename "$migration")"
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$migration" >/dev/null
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database/policies.sql
