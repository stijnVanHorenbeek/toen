# Cloudflare routing topology

## Verified inventory

Read-only inspection on 2026-08-17 found:

- Existing `toen` Worker with `workers.dev` and preview URLs enabled
- Existing Worker deployment history and rollback versions
- Zero Worker Custom Domains
- Zero Cloudflare zones in this account
- R2 API returned code 10042 (“enable R2”); bucket inventory was unavailable
- Existing Static Assets, Images, self-reference service, and Secrets Store bindings plus observability configuration in `wrangler.jsonc`
- Unauthenticated requests to `/admin`, `/admin/`, `/api/admin/events/preview`, and `/api/admin/events/publish` returned Access login redirects

No secret values were read. No Worker, route, domain, Access policy, DNS record, bucket, or binding was changed.

## Constraint

Current `toen.stijnvh.workers.dev` hostname cannot use zone Routes to send `/admin*` directly to a second Worker. Worker Custom Domains and production R2 custom domains require an active Cloudflare zone in the same account as the Worker or bucket. Current account has no zone.

`r2.dev` is development-only, variably rate-limited, and does not provide production custom-domain caching. It is not an acceptable 5,000-event media endpoint. A Worker proxy to R2 would make every image request consume the shared Workers Free request allowance.

## Approved no-domain topology

Operator chose a permanent no-paid-domain path on 2026-08-17.

| Request | Edge behavior | Runtime |
| --- | --- | --- |
| `/`, article HTML, classroom HTML, JS, CSS, fonts, search, facets | Static Assets match first | No Worker invocation |
| Content-addressed WebP media | Static Assets match first | No Worker invocation |
| `/admin` and `/admin/*` | Cloudflare Access, then narrow Worker-first handling | Public Worker and private admin service binding |
| `/api/admin/*` | Cloudflare Access, then narrow Worker-first handling | Public Worker and private admin service binding |
| Unknown public path | Public Worker returns true 404 | No public SSR fallback |

Public delivery remains `toen.stijnvh.workers.dev`. Public Worker must retain default asset-first behavior. Do not set global `run_worker_first: true`; restrict Worker-first patterns to admin and admin API paths.

Use two Worker services:

1. `toen` owns public Static Assets and narrow admin/API dispatch.
2. `toen-admin` sets `workers_dev: false` and `preview_urls: false`.
3. An `ADMIN` service binding is the only route from `toen` to `toen-admin`.
4. Access protects every public admin and admin API path.
5. Admin Worker validates the Access JWT because edge policy is not an application authorization boundary.

Admin volume is expected to remain small. Public pages, search, and media do not consume Worker request quota when Static Assets match first.

## Static media policy

Deploy at most one optimized WebP file per media ID. Reuse content-addressed files across events and releases. Do not generate multiple public renditions on the no-domain path.

Worst-case 5,000-event projection:

| Files | Count |
| --- | ---: |
| Article and classroom HTML | 10,000 |
| Archive index, period, and topic pages | 281 |
| Shared-asset allowance | 128 |
| One media file per event | 5,000 |
| Total | 15,409 |
| Internal target | 16,000 |
| CI hard stop | 18,000 |
| Workers Free limit | 20,000 |

Final generator must count actual deduplicated media files. Deployment must fail before 18,000 files. Full-image upload size and changed-asset behavior require canary measurement before cutover.

R2 may later store private immutable build inputs. Public runtime must not depend on R2, `r2.dev`, or an R2 Worker proxy. Current local images remain fallback until static-media parity passes.

## Deferred custom-domain upgrade

An owned domain remains an optional future optimization, not a migration prerequisite. It would permit separate public, admin, media, and preview hosts plus direct R2 custom-domain delivery. Enabling that topology requires a new decision, benchmark, and explicit infrastructure approval.

## Free-tier gates

- Worker compressed script: 3 MiB
- Worker CPU: 10 ms per HTTP request
- Worker requests: 100,000 per day per account; splitting Workers does not multiply allowance
- Static Assets: 20,000 files per Worker version, 25 MiB per file; matching asset requests are free and unlimited
- No-domain safety budget: 16,000 target and 18,000 CI hard stop
- Admin Worker target: below 1 MiB compressed and 5 ms p95 CPU

## Required approvals

No domain purchase, DNS change, or public R2 endpoint is required for the approved topology.

Explicit operator approval remains required before:

1. Creating or exposing an R2 bucket
2. Creating the private admin Worker or service binding
3. Changing Access applications, policies, or audience values
4. Deploying a canary
5. Activating production traffic
6. Running an A→B→A rollback drill

## Rollback

- Keep current `toen` Worker version and local media during canary.
- Deploy public HTML, media, assets, and Worker code as one immutable version.
- Keep admin deployment independently versioned but schema-reader compatible.
- Snapshot Worker versions, service bindings, Access application, policies, and audience before cutover.
- Use content-addressed media paths; rollback never overwrites or deletes referenced files.
- Restore Worker versions and control-plane resources independently.
- Prohibit media deletion until rollback window closes.

## Sources

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Static Assets routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Workers.dev routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [R2 limits](https://developers.cloudflare.com/r2/platform/limits/)
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)
