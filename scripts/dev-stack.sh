#!/usr/bin/env bash
#
# dev-stack.sh — the full stack in containers, no Aspire: Postgres + authservice + API + web.
# The local mirror of CI's e2e job (REPO-BASELINE §4: "a script that reproduces a CI job 1:1").
#
#   scripts/dev-stack.sh up        build, start and wait until every service answers
#   scripts/dev-stack.sh down      stop and remove the containers and the throwaway database
#   scripts/dev-stack.sh logs [svc]
#   scripts/dev-stack.sh prepare   only generate the throwaway JWT signing key
#   scripts/dev-stack.sh e2e       up, run the Playwright suite, down (even on failure)
#
# Variables (all optional — see scripts/README.md):
#   AUTHSERVICE_IMAGE      image to run; default ghcr.io/konradcinkusz/authservice:v0.3.4
#   AUTHSERVICE_SOURCE     path to a checkout of konradcinkusz/authservice. Used ONLY when the
#                          published image cannot be pulled (offline, or ghcr.io blocked): its
#                          Dockerfile is built read-only into the tag wip-authservice:local.
#   WAIT_SECONDS           how long to wait for the stack, default 240

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
COMPOSE_DIR="${REPO_ROOT}/tests/e2e"
KEY_FILE="${COMPOSE_DIR}/.generated/jwt-signing.pem"
DEFAULT_IMAGE="ghcr.io/konradcinkusz/authservice:v0.3.4"
export AUTHSERVICE_IMAGE="${AUTHSERVICE_IMAGE:-${DEFAULT_IMAGE}}"

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[0;90m%s\033[0m\n' "$*"; }

compose() { docker compose -f "${COMPOSE_DIR}/docker-compose.yml" "$@"; }

prepare() {
  if [ -s "${KEY_FILE}" ]; then
    dim "JWT dev key already present: ${KEY_FILE}"
    return
  fi
  command -v node >/dev/null 2>&1 || { red "node is required to generate the dev key (https://nodejs.org)"; exit 1; }
  node "${REPO_ROOT}/scripts/generate-dev-key.mjs" --out "${KEY_FILE}"
  # The key is bind-mounted read-only into a non-root container: it must be world-readable.
  # It is a throwaway development key, gitignored, and never used outside this compose project.
  chmod 0644 "${KEY_FILE}"
  green "Generated a throwaway JWT signing key (development only)."
}

ensure_authservice_image() {
  [ "${AUTHSERVICE_IMAGE}" = "${DEFAULT_IMAGE}" ] || return 0
  if docker image inspect "${DEFAULT_IMAGE}" >/dev/null 2>&1; then return 0; fi
  if docker pull "${DEFAULT_IMAGE}" >/dev/null 2>&1; then return 0; fi
  if [ -n "${AUTHSERVICE_SOURCE:-}" ] && [ -f "${AUTHSERVICE_SOURCE}/src/AuthService/Dockerfile" ]; then
    dim "Cannot pull ${DEFAULT_IMAGE}; building ${AUTHSERVICE_SOURCE} into wip-authservice:local (read-only use)."
    docker build -t wip-authservice:local -f "${AUTHSERVICE_SOURCE}/src/AuthService/Dockerfile" "${AUTHSERVICE_SOURCE}"
    export AUTHSERVICE_IMAGE="wip-authservice:local"
    return 0
  fi
  red "Cannot pull ${DEFAULT_IMAGE} and AUTHSERVICE_SOURCE is not set."
  echo "Set AUTHSERVICE_SOURCE to a checkout of konradcinkusz/authservice, or AUTHSERVICE_IMAGE to an image you can pull." >&2
  exit 1
}

wait_for() { # name url
  local name="$1" url="$2" waited=0 limit="${WAIT_SECONDS:-240}"
  until curl -fsS -o /dev/null "${url}"; do
    waited=$((waited + 3))
    if [ "${waited}" -ge "${limit}" ]; then
      red "${name} did not answer ${url} within ${limit}s."
      compose logs --tail 60 || true
      exit 1
    fi
    sleep 3
  done
  green "  ${name} is up (${url})"
}

up() {
  prepare
  ensure_authservice_image
  compose up --build -d
  echo "Waiting for the stack..."
  wait_for authservice "http://localhost:8080/health/ready"
  wait_for api         "http://localhost:8081/health"
  wait_for web         "http://localhost:3000/healthz"
  green "Stack is up: web http://localhost:3000 · api http://localhost:8081 · authservice http://localhost:8080"
}

down() { compose down -v --remove-orphans; }

case "${1:-}" in
  up)      up ;;
  down)    down ;;
  logs)    shift; compose logs -f "$@" ;;
  prepare) prepare ;;
  e2e)
    trap down EXIT
    up
    (cd "${REPO_ROOT}" && pnpm --filter e2e test)
    ;;
  *) echo "Usage: scripts/dev-stack.sh {up|down|logs [service]|prepare|e2e}" >&2; exit 2 ;;
esac
