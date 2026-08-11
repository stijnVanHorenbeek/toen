#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${TOEN_CONTENT_DIR:-}" ]]; then
	pnpm build:worker
else
	content_sha="${TOEN_CONTENT_SHA:-f6c5ad91b9aaf4c91cd5fef2bdf23736386f054d}"
	TOEN_CONTENT_SHA="$content_sha" pnpm build:worker
fi
pnpm exec bddgen
pnpm exec playwright test
