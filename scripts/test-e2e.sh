#!/usr/bin/env bash
set -euo pipefail

content_sha="${TOEN_CONTENT_SHA:-88e141b364b1330c07f6481525fc46afdce901d1}"
TOEN_CONTENT_SHA="$content_sha" pnpm build:worker
pnpm exec bddgen
pnpm exec playwright test
