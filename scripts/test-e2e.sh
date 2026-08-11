#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${TOEN_CONTENT_DIR:-}" ]]; then
	pnpm build:worker
else
	content_sha="${TOEN_CONTENT_SHA:-18c3b191531bf92e196ca5be7aa2f1bea37cdac1}"
	TOEN_CONTENT_SHA="$content_sha" pnpm build:worker
fi
pnpm exec bddgen
pnpm exec playwright test
