#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${TOEN_CONTENT_DIR:-}" ]]; then
	pnpm content:sync
else
	content_sha="${TOEN_CONTENT_SHA:-5e94da774fe06659695fd41eb023c93000dca16a}"
	TOEN_CONTENT_SHA="$content_sha" pnpm content:sync
fi

if [[ "${TOEN_E2E_VERIFY_APP:-}" == "1" ]]; then
	pnpm verify:synced
fi

pnpm content:search:dev
pnpm assets:workers
pnpm assets:media
export TOEN_ALLOW_DEVELOPMENT_SEARCH=1
pnpm build:static:synced
pnpm exec bddgen
pnpm exec playwright test
