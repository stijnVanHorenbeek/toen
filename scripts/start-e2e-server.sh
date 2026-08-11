#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .open-next/worker.js ]]; then
	echo "Missing .open-next/worker.js. Run pnpm build:worker before Playwright." >&2
	exit 1
fi

exec pnpm exec wrangler dev --port 8787
