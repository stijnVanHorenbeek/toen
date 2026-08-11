#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${TOEN_CONTENT_DIR:-}" ]]; then
	pnpm build:worker
else
	content_sha="${TOEN_CONTENT_SHA:-30c92b52fd76d438194c1ed155e8aa6c1f1297af}"
	TOEN_CONTENT_SHA="$content_sha" pnpm build:worker
fi
pnpm exec bddgen
pnpm exec playwright test
