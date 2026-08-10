#!/usr/bin/env bash
set -euo pipefail

log_file="${RUNNER_TEMP:-/tmp}/toen-wrangler.log"
pnpm exec wrangler dev --port 8787 >"$log_file" 2>&1 &
worker_pid=$!

cleanup() {
	kill "$worker_pid" 2>/dev/null || true
	wait "$worker_pid" 2>/dev/null || true
}
trap cleanup EXIT

for _ in {1..30}; do
	if curl --fail --silent --output /dev/null http://localhost:8787; then
		pnpm test:e2e
		exit 0
	fi
	if ! kill -0 "$worker_pid" 2>/dev/null; then
		cat "$log_file"
		exit 1
	fi
	sleep 1
done

cat "$log_file"
echo "Worker preview did not start within 30 seconds." >&2
exit 1
