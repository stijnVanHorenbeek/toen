# Browser search v1

## Delivery contract

Production content sync now projects exact clean application and content SHAs before Next.js builds. `content:stage` verifies release pointer, manifest, public roles, byte lengths, and SHA-256 values before it copies only release-qualified `search.json` and `facets.json` into public assets.

Next.js build configuration reads generated pointers once and embeds release ID, search URL, and browser Worker URL. Homepage discovery runtime does not read Markdown or generated pointer files. Local development uses `content:search:dev`; production builds reject its pointer unless the explicit end-to-end test override is present.

Transitional article and classroom routes still package Markdown through OpenNext. Static page generation task `TODO-c0b225ee` removes that separate legacy dependency. Browser search work removes full catalog from homepage React/RSC now; it does not claim final OpenNext retirement.

Browser Worker is bundled separately with esbuild. Build writes a content-hashed JavaScript filename and verified pointer. Next/OpenNext production build contains that JavaScript asset and no raw TypeScript Worker file.

## Client boundary

Homepage server output contains:

- Four ranked initial events
- Total result count and period-fallback state
- Year range
- Topic IDs and labels
- Exact release-qualified search URL
- Content-hashed Worker URL

It does not contain remaining catalog entries. A 5,000-event bootstrap serializes below 10,000 bytes in the contract test.

Browser preloads search during idle time unless data-saver mode is active. First interaction also starts loading. Query and filter changes debounce for 180 ms. Main thread sends preferences and receives at most 24 ranked entries. Request IDs discard stale responses.

Worker validates same-origin relative path, expected release ID, response byte length before JSON parsing, schema version, event count, duplicate slugs, nested strings and arrays, dates, topics, mechanics, and durations. Global topic labels are attached inside Worker preparation so label search remains compatible without repeating labels in every index entry.

Ranking engine is shared by server bootstrap and Worker. It preserves query normalization, BCE/CE periods, calendar-week proximity, activity priority, topic preferences, period fallback, and code-unit slug tie-breaks. Worker prepares normalized search text and signed years once per release.

## Bounded rendering and fallback

Initial DOM renders four recommendations. Expanded and paginated Worker responses render at most 24 recommendations. Controls expose loading state, generic failure and retry, page position, previous/next navigation, and heading focus after page changes.

Static fallback does not require Worker execution:

- `/archive` lists period and topic archives.
- Up to 24 period pages cover signed historical years.
- Up to 256 topic pages cover validated topic IDs.
- Archive pages contain crawlable links to canonical event articles.

These pages raise worst-case 5,000-event Static Assets projection to 15,409 files. Target remains 16,000; release generation and CI stop at 18,000 before Cloudflare Free 20,000-file limit.

## Measured 5,000-event result

Run:

```bash
pnpm benchmark:search /tmp/toen-search-5000.json
```

Measured on 2026-08-17 with Chromium 151.0.7922.34 and 4× CPU throttling:

| Measurement | Result | Gate |
| --- | ---: | ---: |
| Search JSON | 1,905,097 bytes | ≤2.5 MiB |
| Search JSON Brotli | 34,245 bytes | ≤750 KiB |
| Bundled Worker | 7,643 bytes | ≤128 KiB internal cap |
| Cold fetch, parse, and first search | 113.2 ms | Informational |
| Warm search round-trip p95 | 3.0 ms | <50 ms |
| Warm search maximum | 25.5 ms | Informational |
| Main-thread tasks over 50 ms | 0 | 0 |
| Result DOM nodes | 48 | ≤48 |

Synthetic labels and summaries compress more than a diverse production catalog. Release generation still enforces raw and Brotli limits on real content. Four-times CPU throttling is reproducible proxy evidence, not physical-device evidence.

## Validation

- Shared ranking characterization: 12 cases, including pagination.
- Search artifact/runtime contract: schema, bounds, label hydration, one-load cache, same-origin path, and 24-item page.
- Browser Worker bundle: byte-deterministic content hash, no unresolved alias or TypeScript syntax.
- Homepage Playwright-BDD: 15 scenarios passed, including real search, stale-input replacement, and archive fallback.
- Complete Playwright-BDD regression suite: 135 scenarios passed.
- Next/OpenNext production build emitted static search and Worker assets and no raw Worker source.
