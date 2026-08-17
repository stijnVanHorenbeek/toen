# Static-first 5,000-event benchmark

## Purpose

This benchmark measures current OpenNext scaling and candidate static-first budgets before migration. It uses synthetic filenames and verified canonical templates in a detached temporary worktree. It never writes fixtures into active `content/events`.

Run:

```bash
pnpm benchmark:architecture --count=5000 --output=/tmp/toen-architecture-benchmark-5000.json
```

Use `--skip-current-build` for projection-only checks. Complete current-build measurement supports macOS and Linux. It creates a cold application worktree, installs dependencies from pnpm store, generates and validates 5,000 event files, runs `build:worker:synced`, runs Wrangler dry-run and startup profiling, executes throttled Chromium projection, writes JSON report, and verifies worktree removal.

## Baseline

Measured on 2026-08-17 with:

- Application SHA: `dad104bc1da5e6e5f61fa72a20df34703b59d8d6`
- Content template SHA: `5e94da774fe06659695fd41eb023c93000dca16a`
- Node.js: 26.5.0
- pnpm: 11.15.1
- Next.js: 16.2.11
- OpenNext Cloudflare: 1.20.2
- Wrangler: 4.120.0
- Chromium: 151.0.7922.34 with 4× CPU throttling
- Host: Apple M2 Pro, 10 logical CPUs, 16 GiB memory
- Warm pnpm package store and cold `.next`/`.open-next` output

Fixture cycles four verified canonical event documents across deterministic slugs. This preserves representative bodies and beats while preventing synthetic material from entering canonical content. Report records application/content SHAs, template hashes, tracked-diff hash, untracked-file hashes, benchmark-script hash, runtime versions, and host profile. It measures structural and approximate content-volume costs, not editorial diversity.

## Current OpenNext result

| Measurement | Result |
| --- | ---: |
| Event documents | 5,000 |
| Markdown bytes | 36,863,750 |
| Generated article pages | 5,000 |
| Generated classroom pages | 5,000 |
| Total generated pages reported by Next.js | 10,006 |
| Separate catalog validation | 5.28 s / 348 MB peak RSS |
| Build wall time | 78.4 s |
| Peak build process-tree RSS | 4.17 GB |
| `.next` output | 1.18 GB / 216,487 files |
| `.open-next` output | 709 MB / 16,168 files |
| Event-route files inside `.next` | 105,018 |
| Homepage HTML | 2,143,587 bytes |
| Homepage RSC | 1,895,831 bytes |
| Wrangler upload | 61,425,347 bytes raw |
| Wrangler upload gzip | 2,691,973 bytes |
| Local Worker startup profile | 37.9 ms active / 191.5 ms window |

Wrangler accepted the dry-run, but this result leaves about 454 KB below the 3 MiB compressed Worker limit. Raw upload also approaches the 64 MiB pre-compression limit. Small runtime or dependency growth can exhaust either margin.

Current build therefore scales route count faster than useful public files, embeds the complete catalog in the homepage, and attaches 5,000 Markdown modules to the Worker. Build duration is acceptable on this machine; output shape, browser payload, and deployment headroom are not.

## Candidate static-first projection

| Measurement | Result | Target |
| --- | ---: | ---: |
| Article pages | 5,000 | 5,000 |
| Classroom pages | 5,000 | 5,000 |
| Archive index, period, and topic pages | 281 | ≤281 |
| Shared-asset allowance | 128 | 128 |
| One WebP per event | 5,000 | 5,000 |
| Total Static Assets files | 15,409 | ≤16,000 |
| CI hard stop | 18,000 | <20,000 Cloudflare limit |
| Candidate search JSON | 1,437,594 bytes raw | ≤2.5 MiB |
| Candidate search JSON Brotli | 126,699 bytes | ≤750 KiB |
| Candidate Node search p95 | 5.11 ms | Diagnostic only |
| Throttled Chromium Worker parse | 2.5 ms | Projection |
| Throttled Chromium Worker preparation | 12.8 ms | Projection |
| Throttled Chromium search p95 | 0.5 ms | ≤50 ms |
| Worker first-message round trip | 41.8 ms | Informational load cost |
| Bounded 24-card DOM | 168 nodes / 0.4 ms | No target long task |
| Synthetic legacy 5,000-card DOM | 35,000 nodes / 73.7 ms | Must not ship |
| Optional private R2 build-input projection | 1,143,377,500 bytes | Diagnostic only |
| Full-replacement private rollback scenario | 2,286,755,000 bytes | Diagnostic only |

Candidate search and DOM projections are provisional. Chromium 4× CPU throttling gives reproducible low-end proxy evidence, not physical-device proof. Media size is a four-file linear scenario; final WebP sizes and deduplication require measurement. R2 is optional private build storage and is not part of public delivery.

## Decision

Proceed with static-first migration:

1. Freeze deterministic release and public DTO contracts.
2. Keep public Static Assets asset-first, target at or below 16,000 files, and fail CI at 18,000.
3. Move catalog search into a lazy browser Web Worker.
4. Generate one HTML article and one classroom page per event without RSC segment sidecars.
5. Remove canonical Markdown from the public Worker package.
6. Serve one content-addressed WebP per media ID through Static Assets; keep R2 optional and private.
7. Keep D1 blocked unless two representative browser benchmarks miss agreed search gates.

## Remaining evidence

All required benchmark gates passed. Later tasks must still measure:

- Production Web Worker latency, memory, and main-thread behavior on agreed physical low-end device
- Final static generator output size and file count
- Native admin Worker compressed size and CPU
- Final deduplicated WebP count, bytes, and changed-asset upload behavior
- Asset-first page and media routing on approved canary infrastructure
- Exact-SHA activation and A→B→A rollback
