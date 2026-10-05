#!/usr/bin/env bash
#
# add-migration.sh — add an EF Core migration for the API's PostgreSQL schema.
#
#   scripts/add-migration.sh AddJobViewCounter
#
# P4: the schema moves by migrations, never by EnsureCreated, and reference data is seeded by a
# separate service rather than HasData. CI fails when the model and the migrations disagree
# (`dotnet ef migrations has-pending-model-changes`).

set -euo pipefail

NAME="${1:?usage: scripts/add-migration.sh <MigrationName>}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

if ! dotnet ef --version >/dev/null 2>&1; then
  echo "dotnet-ef is not installed: dotnet tool install --global dotnet-ef --version 10.*" >&2
  exit 1
fi

# No connection string is needed to scaffold a migration, and none is set here.
DATABASE_PROVIDER=PostgreSQL dotnet ef migrations add "${NAME}" \
  --project src/WorkInPoland.Api \
  --startup-project src/WorkInPoland.Api \
  --output-dir Migrations
