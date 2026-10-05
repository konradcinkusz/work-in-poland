#!/usr/bin/env bash
#
# smoke-public.sh — the assertions a health check cannot make, against PUBLIC URLs.
#
#   scripts/smoke-public.sh <web-url> <api-url> <authservice-url>
#
# Run by the deploy workflow after the last app is up, and by hand against any environment. Every
# check fails loudly with what it expected; "the workflow went green" is not the definition of done,
# the public URL working is (INIT-GENERIC-TEMPLATE §11).

set -euo pipefail

WEB="${1:?usage: smoke-public.sh <web-url> <api-url> <authservice-url>}"
API="${2:?missing api url}"
AUTH="${3:?missing authservice url}"

fail() { printf '\033[0;31mFAIL\033[0m %s\n' "$*" >&2; exit 1; }
pass() { printf '\033[0;32mok\033[0m   %s\n' "$*"; }
retry() { # cmd...  — a scale-to-zero machine can take a while to wake
  local n=0; until "$@"; do n=$((n + 1)); [ "${n}" -ge 15 ] && return 1; sleep 4; done
}

retry curl -fsS -o /dev/null "${WEB}/healthz" || fail "web /healthz did not answer"
pass "web /healthz"

CONFIG="$(curl -fsS "${WEB}/api/config")"
echo "${CONFIG}" | jq -e '.publicApiUrl | startswith("http")' >/dev/null || fail "web /api/config has no publicApiUrl: ${CONFIG}"
pass "web /api/config returns runtime addresses"

curl -fsS "${WEB}/" | grep -qi "<h1" || fail "web home page has no <h1>"
pass "web home page renders"

retry curl -fsS -o /dev/null "${API}/health" || fail "api /health did not answer"
HEALTH="$(curl -fsS "${API}/health")"
echo "${HEALTH}" | jq -e '.status' >/dev/null || fail "api /health is not the integrations report: ${HEALTH}"
pass "api /health lists its integrations"

curl -fsS "${API}/api/v1/stats" | jq -e '.publishedJobs >= 0' >/dev/null || fail "api /api/v1/stats"
curl -fsS "${API}/api/v1/jobs?limit=1" | jq -e '.items | type == "array"' >/dev/null || fail "api /api/v1/jobs"
pass "api serves public reads"

# The JWKS must be non-empty: otherwise every consumer rejects every token while looking healthy.
KEYS="$(curl -fsS "${AUTH}/.well-known/jwks.json" | jq '.keys | length')"
[ "${KEYS}" -ge 1 ] || fail "authservice JWKS is empty"
pass "authservice JWKS publishes ${KEYS} key(s)"

# MCP, anonymous: initialize, then list tools (Streamable HTTP, JSON-RPC over POST).
INIT_HDRS="$(mktemp)"
curl -fsS -D "${INIT_HDRS}" -o /dev/null "${API}/mcp" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}' \
  || fail "MCP initialize on /mcp"
SESSION="$(grep -i '^mcp-session-id:' "${INIT_HDRS}" | tr -d '\r' | awk '{print $2}' || true)"
SESSION_HEADER=()
[ -n "${SESSION}" ] && SESSION_HEADER=(-H "Mcp-Session-Id: ${SESSION}")
curl -fsS "${API}/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' "${SESSION_HEADER[@]}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null || true
TOOLS="$(curl -fsS "${API}/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' "${SESSION_HEADER[@]}" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')"
echo "${TOOLS}" | grep -q "search_jobs" || fail "anonymous /mcp does not list search_jobs: ${TOOLS}"
echo "${TOOLS}" | grep -q "post_job" && fail "anonymous /mcp lists an account tool (post_job)"
pass "anonymous MCP lists public tools only"

# The OAuth endpoint must challenge, pointing at its protected-resource metadata.
CHALLENGE="$(curl -sS -i -o /dev/null -D - "${API}/mcp/account" -H 'Content-Type: application/json' -d '{}' | tr -d '\r' | grep -i '^www-authenticate:' || true)"
echo "${CHALLENGE}" | grep -qi "resource_metadata" || fail "/mcp/account did not answer 401 with resource_metadata (got: '${CHALLENGE}')"
curl -fsS "${API}/.well-known/oauth-protected-resource/mcp/account" | jq -e '.authorization_servers[0]' >/dev/null || fail "protected-resource metadata"
curl -fsS "${AUTH}/.well-known/oauth-authorization-server" | jq -e '.authorization_endpoint' >/dev/null || fail "authservice authorization-server metadata"
pass "OAuth MCP challenge and metadata chain"

printf '\033[0;32mSmoke passed.\033[0m\n'
