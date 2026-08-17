#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .generated/static-site/index.html ]]; then
	echo "Missing .generated/static-site/index.html. Run pnpm build:static before Playwright." >&2
	exit 1
fi

exec pnpm exec wrangler dev --config wrangler.static.jsonc --port 8787
