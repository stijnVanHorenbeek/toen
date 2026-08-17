# Admin SPA and Worker v1

## Purpose

Move protected authoring UI and APIs out of OpenNext runtime. Production keeps `/admin` and `/api/admin/*` on public `workers.dev` host, preserves Cloudflare Access path protection, and adds internal Access JWT verification to every supported API operation.

## Topology

`toen` serves static public site and `admin.html`. Static Assets handle normal files first. Public router runs first only for `/api/admin/*` and forwards those requests through `ADMIN_API` service binding.

`toen-admin` contains native API Worker only. It has:

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

Preview reuses canonical draft projection. Production binds only Access settings, so publication defaults to dry-run. GitHub and release-pipeline bindings remain absent until separately approved.

## Build and budgets

Run:

```bash
pnpm assets:admin
pnpm assets:admin:check
pnpm benchmark:admin
```

Esbuild rejects Markdown, synchronized content files, OpenNext, and Next runtime inputs. Wrangler dry-run package gate measures final platform bundle after compatibility transforms. `ci:build` runs both package and complete static-site gates.

Measured final API Worker:

- source bundle: 910,497 raw bytes / 255,036 gzip bytes;
- Wrangler package: 1,280,279 raw bytes / 298,595 gzip bytes;
- target: less than 1 MiB gzip;
- Cloudflare Free maximum: 3 MiB compressed.

1,000-request preview benchmark includes real local RS256 Access JWT verification against cached key, bounded body reading, JSON parsing, strict event validation, and preview projection. It measures CPU path after JWK availability; production observation must measure first-fetch latency separately:

- p95: 0.281 ms;
- maximum: 1.055 ms;
- target: p95 below 5 ms.

Report: `/tmp/toen-admin-api-benchmark-final.json`.

## Validation

- Native request tests cover missing configuration, authentication, origin, media type, declared and streamed size, malformed UTF-8/JSON, structural depth/node count, unknown fields, unread-body cancellation, and no-store errors.
- Worker route tests cover both exact paths, methods, 404, route-level unread-body cancellation, and no-store behavior.
- Public router tests prove only `/api/admin/*` reaches private binding.
- Local dual-Worker run showed service binding transition from disconnected to connected and returned 20 controlled `401` responses without request-stream or process failure.
- Static admin SPA passed 75/75 BDD journeys, including exact build-to-activation state transition.
- Existing OpenNext application passed complete 136/136 BDD suite after release-reader and polling changes.
- Public static homepage/event/classroom suite passed 61/61.
- Dry-runs validated both Worker configurations.
- Production deployment on 2026-08-17 created private `toen-admin` version `c76ec211-6724-4b00-a1d3-be4969e6297a`.
- Public smoke checks confirmed Access redirects for `/admin` and `/api/admin/*`; private workers.dev request returned `404`.

## Production state

Production `toen` routes admin APIs through private `toen-admin`. External Access remains mandatory. Admin Worker binds only Access team domain and audience, which keeps publication in dry-run mode. Enable GitHub or exact-release bindings only through a separate approved rollout.
