#!/usr/bin/env bash
#
# check-kernel-size.sh — P2's mechanical ceiling: the shared kernel stays a kernel.
#
# "Stating the limit in prose has already failed twice in this estate" (P2). This is the CI half;
# the architecture test in tests/WorkInPoland.Api.Tests asserts the same number from inside the
# test run, and that the kernel references no entity type.
#
#   scripts/check-kernel-size.sh            # fails above the ceiling
#   KERNEL_CEILING=900 scripts/check-kernel-size.sh

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
KERNEL="${REPO_ROOT}/src/WorkInPoland.ServiceDefaults"
CEILING="${KERNEL_CEILING:-800}"

if [ ! -d "${KERNEL}" ]; then
  echo "check-kernel-size: ${KERNEL} does not exist." >&2
  exit 1
fi

LINES="$(find "${KERNEL}" -name '*.cs' -not -path '*/obj/*' -not -path '*/bin/*' -print0 | xargs -0 cat | wc -l | tr -d ' ')"

echo "WorkInPoland.ServiceDefaults: ${LINES} lines of C# (ceiling ${CEILING})."
if [ "${LINES}" -gt "${CEILING}" ]; then
  echo "The kernel is over its ceiling. Business entities, rules, seed data and user-facing strings" >&2
  echo "do not belong in it (P2): move the code to the service that owns it, or to Contracts if two" >&2
  echo "services need the same DTOs." >&2
  exit 1
fi
