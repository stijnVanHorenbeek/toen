# Admin SPA and Worker v1

## Purpose

Move protected authoring UI and APIs out of OpenNext runtime without changing current production routes. Shadow architecture keeps `/admin` and `/api/admin/*` on public `workers.dev` host, preserves Cloudflare Access path protection, and adds internal Access JWT verification to every supported API operation.

No service, binding, Access policy, route, secret, or deployment changed during this work.

## Topology

`toen-static-canary` serves static public site and `admin.html`. Static Assets handle normal files first. Public router runs first only for `/api/admin/*` and forwards those requests through `ADMIN_API` service binding.

`toen-admin-canary` contains native API Worker only. It has:

- `workers_dev: false`;
- `preview_urls: false`;
- no route or Static Assets binding;
- existing least-privilege Secrets Store references;
- observability enabled;
- Node.js compatibility for GitHub App key handling.

Service binding invokes private Worker without public Internet hop. Existing Access policy remains required on `/admin*` and `/api/admin/*`. Internal JWT validation is defense in depth, not substitute for external Access.

## Admin SPA

Static generator emits `admin.html` with `noindex,nofollow`, small topic bootstrap, and content-hashed module entry. SPA reuses complete `EventDraftForm` and `EventAuthoringProvider` workflow:

- local draft restoration and explicit discard;
- hostile ChatGPT import and provenance checks;
- source/claim review and invalidation;
- production `EventArticle` and `BeatPlayer` preview;
- explicit publication confirmation;
- GitHub App publication boundaries.

Review UI remains lazy-loaded as shared chunk. Canonical event content and full catalog do not enter admin bootstrap.

## API contract

Native Worker exposes exact POST routes only:

- `/api/admin/events/preview`
- `/api/admin/events/publish`

Known routes reject other methods with `405` and `Allow: POST`. Unknown paths return `404`. Every response uses `Cache-Control: no-store`.

Request processing fails closed:

1. Resolve Access team origin and audience from environment or Secrets Store.
2. Verify `Cf-Access-Jwt-Assertion` issuer, audience, signature, expiry, and email. Cache remote JWK set per trusted team domain inside Worker isolate.
3. Require `Origin` to equal request URL origin.
4. Require `Content-Type: application/json`.
5. Reject invalid or declared length above 256 KiB.
6. Read stream with independent 256 KiB limit and cancel rejected/unread bodies.
7. Decode strict UTF-8 and parse JSON.
8. Reject structures deeper than 32 levels or larger than 10,000 JSON nodes.
9. Apply strict exhaustive event schema. Browser-supplied slug remains only tolerated noncanonical field and is always replaced from title/date.

Preview reuses canonical draft projection. Publish reuses existing Access identity, GitHub App configuration, content conflict checks, dry-run behavior, and Deploy Hook semantics.

## Build and budgets

Run:

```bash
pnpm assets:admin
pnpm assets:admin:check
pnpm benchmark:admin
```

Esbuild rejects Markdown, synchronized content files, OpenNext, and Next runtime inputs. Wrangler dry-run package gate measures final platform bundle after compatibility transforms. `ci:build` runs both package and complete static-site gates.

Measured final API Worker:

- source bundle: 900,833 raw bytes / 252,454 gzip bytes;
- Wrangler package: 1,268,324 raw bytes / 295,733 gzip bytes;
- target: less than 1 MiB gzip;
- Cloudflare Free maximum: 3 MiB compressed.

1,000-request preview benchmark includes real local RS256 Access JWT verification against cached key, bounded body reading, JSON parsing, strict event validation, and preview projection. It measures CPU path after JWK availability; canary must measure first-fetch latency separately:

- p95: 0.305 ms;
- maximum: 1.439 ms;
- target: p95 below 5 ms.

Report: `/tmp/toen-admin-api-benchmark-final.json`.

## Validation

- Native request tests cover missing configuration, authentication, origin, media type, declared and streamed size, malformed UTF-8/JSON, structural depth/node count, unknown fields, unread-body cancellation, and no-store errors.
- Worker route tests cover both exact paths, methods, 404, route-level unread-body cancellation, and no-store behavior.
- Public router tests prove only `/api/admin/*` reaches private binding.
- Local dual-Worker run showed service binding transition from disconnected to connected and returned 20 controlled `401` responses without request-stream or process failure.
- Static admin SPA passed 74/74 existing admin BDD journeys.
- Existing OpenNext application passed complete 135/135 BDD suite after handler and lazy-loading changes.
- Public static homepage/event/classroom suite passed 61/61.
- Dry-runs validated both Worker configurations. No upload or deployment occurred.

## Cutover boundary

Canary requires explicit approval before:

1. creating private admin service;
2. attaching Secrets Store bindings;
3. creating public canary and service binding;
4. applying or extending Access coverage to canary paths;
5. uploading or publishing either Worker.

Current `toen` OpenNext Worker remains production. Cutover waits for exact-SHA publication pipeline, accepted canary, rollback drill, and operator approval.
