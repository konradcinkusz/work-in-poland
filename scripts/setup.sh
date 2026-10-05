#!/usr/bin/env bash
#
# setup.sh — one-command onboarding (REPO-BASELINE §3), numbered steps.
#
#   ./scripts/setup.sh             check prerequisites, install deps and hooks, generate the dev key
#   ./scripts/setup.sh --check     strict: report what is missing BY NAME and exit non-zero. Installs
#                                  nothing and changes nothing (safe on a machine with nothing installed)
#
# The Windows twin is scripts/setup.ps1. After it runs:
#
#   dotnet run --project src/WorkInPoland.AppHost
#
# with an empty .env and no cloud credentials is a working system with reduced features (P8):
# no email delivery, no social login. Every optional integration below says which feature it buys.

set -uo pipefail

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}" || exit 1

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
amber() { printf '\033[0;33m%s\033[0m\n' "$*"; }
dim()   { printf '\033[0;90m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

MISSING=()
miss() { MISSING+=("$1"); red "  ✗ $1"; echo "    $2"; }
version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]; }

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
step "1. Prerequisites"

if command -v dotnet >/dev/null 2>&1; then
  DOTNET_V="$(dotnet --version 2>/dev/null || echo 0)"
  if version_ge "${DOTNET_V}" "10.0.100"; then green "  ✓ .NET SDK ${DOTNET_V}"
  else miss ".NET SDK 10 (found ${DOTNET_V})" "Install: https://dotnet.microsoft.com/download/dotnet/10.0 — global.json pins the 10.0 band"; fi
else
  miss ".NET SDK 10" "Install: https://dotnet.microsoft.com/download/dotnet/10.0"
fi

if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -p 'process.versions.node')"
  if version_ge "${NODE_V}" "22.0.0"; then green "  ✓ node ${NODE_V}"
  else miss "node 22 or newer (found ${NODE_V})" "Install: https://nodejs.org/en/download"; fi
else
  miss "node 22 or newer" "Install: https://nodejs.org/en/download (also generates the dev signing key — no openssl needed)"
fi

if command -v pnpm >/dev/null 2>&1; then green "  ✓ pnpm $(pnpm -v)"
else miss "pnpm" "Install: corepack enable && corepack prepare pnpm@latest --activate   (or https://pnpm.io/installation)"; fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  green "  ✓ container engine (the AppHost runs Postgres and authservice as containers)"
else
  miss "a running container engine (Docker or Podman)" "Install: https://docs.docker.com/get-docker/ — the AppHost needs it for Postgres and authservice; the unit tests do not"
fi

if command -v gitleaks >/dev/null 2>&1; then green "  ✓ gitleaks (the pre-commit hook uses it directly)"
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  green "  ✓ no gitleaks, but Docker is running — the hook falls back to the same container CI uses"
else
  miss "a secret scanner (gitleaks, or Docker)" "The pre-commit hook REFUSES to commit without one — by design (P5). https://github.com/gitleaks/gitleaks#installing"
fi

if [ "${CHECK_ONLY}" -eq 1 ]; then
  echo
  if [ "${#MISSING[@]}" -eq 0 ]; then green "All prerequisites present."; exit 0; fi
  red "Missing: ${MISSING[*]}"; exit 1
fi
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo; red "Fix the missing prerequisites above, then re-run ./scripts/setup.sh."; exit 1
fi

# ── 2. Dependencies ──────────────────────────────────────────────────────────
step "2. Dependencies"
if dotnet restore WorkInPoland.sln >/dev/null; then green "  ✓ dotnet restore"; else red "  dotnet restore failed"; exit 1; fi
if PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile >/dev/null; then green "  ✓ pnpm install"; else red "  pnpm install failed"; exit 1; fi
dim "  Browser for the e2e suite is not downloaded here: pnpm --filter e2e exec playwright install chromium"

# ── 3. Git hooks ─────────────────────────────────────────────────────────────
step "3. Git hooks"
HOOK_DST="$(git rev-parse --git-path hooks)/pre-commit"
mkdir -p "$(dirname "${HOOK_DST}")"
cp scripts/hooks/pre-commit "${HOOK_DST}" && chmod +x "${HOOK_DST}"
green "  ✓ pre-commit secret scan installed (${HOOK_DST})"

# ── 4. Local secret store ────────────────────────────────────────────────────
step "4. Local secret store (dotnet user-secrets, behind Aspire parameters)"
APPHOST="src/WorkInPoland.AppHost"
dotnet user-secrets init --project "${APPHOST}" >/dev/null 2>&1 || true

# ── 5. The one mandatory secret ──────────────────────────────────────────────
step "5. Development signing key (the one mandatory secret — generated, never invented)"
if dotnet user-secrets list --project "${APPHOST}" 2>/dev/null | grep -q '^Parameters:jwt-private-key'; then
  green "  ✓ already set (Parameters:jwt-private-key)"
else
  KEY="$(node scripts/generate-dev-key.mjs)"
  dotnet user-secrets set "Parameters:jwt-private-key" "${KEY}" --project "${APPHOST}" >/dev/null
  green "  ✓ generated an RSA-2048 PKCS#8 key into the user-secrets store"
  dim "  Journey: user-secrets -> AppHost parameter 'jwt-private-key' -> authservice env Jwt__PrivateKeyPem -> config key Jwt:PrivateKeyPem."
  dim "  A local key is a development convenience, never a production trust root."
fi

# ── 6. Optional integrations ─────────────────────────────────────────────────
step "6. Optional integrations (each is skipped by default; a fresh clone with all skipped still runs)"
cat <<'TXT'
  (optional — needed for real email delivery: verification and password-reset links)
      dotnet user-secrets set "Parameters:sendgrid-api-key"    "<key>"   --project src/WorkInPoland.AppHost
      dotnet user-secrets set "Parameters:sendgrid-from-email" "<addr>"  --project src/WorkInPoland.AppHost
      Without it authservice only LOGS the emails; sign-up still works because email confirmation is
      then not required.
  (optional — needed for "Zaloguj się przez Google/GitHub")
      dotnet user-secrets set "Parameters:google-client-id"     "<id>"     --project src/WorkInPoland.AppHost
      dotnet user-secrets set "Parameters:google-client-secret" "<secret>" --project src/WorkInPoland.AppHost
      (and the github-* pair). Without them the buttons are simply not rendered: the web app draws
      them from authservice's /external-auth/providers.
TXT

step "Done"
green "Next:  dotnet run --project src/WorkInPoland.AppHost     (Aspire dashboard prints the URLs)"
echo  "Or the containerised stack without Aspire:  scripts/dev-stack.sh up"
echo  "Troubleshooting keyed on the literal error text: scripts/README.md"
