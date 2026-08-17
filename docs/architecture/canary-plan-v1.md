# Static-first canary plan v1

## Boundary

Canary validates separate `toen-static-canary` and private `toen-admin-canary`. Production `toen.stijnvh.workers.dev` receives no traffic, route, binding, secret, Access, deployment, or rollback change.

All actions below marked **mutation** require explicit operator approval. Current work stops before first mutation.

No paid domain or R2 delivery path is used. Static Assets serve HTML, search, browser bundles, and content-addressed WebP files.

## Exact inputs

Record before mutation:

| Input | Required value |
| --- | --- |
| Application commit | `722a499` full 40-character SHA after remote push |
| Content reader commit | `9a9ea37` full 40-character SHA after remote push |
| Static tree digest | recompute from clean remote SHAs |
| Current production version | read-only inventory |
| Existing canary versions | none or recorded IDs |
| Public Worker name | `toen-static-canary` |
| Private Worker name | `toen-admin-canary` |
| Content canary branch | `canary-static-v1` |
| Application source branch | current reviewed branch or `canary-static-v1` |
| Operator | record |
| Date/time | UTC |

Local abbreviated SHAs are not deployment inputs.

## Required mutations

### GitHub

1. Push content reader commit before application writer commit.
2. Create or update content branch `canary-static-v1` from reader commit.
3. Create approved synthetic 5,000-event commit on canary content branch.
4. Push reviewed application commit so Cloudflare can fetch exact SHA.

Do not merge to `main` during canary.

### Cloudflare services and Access

1. Create private `toen-admin-canary` with `workers_dev:false` and preview URLs disabled.
2. Bind existing legacy Secrets Store values plus six exact-release settings.
3. Create `toen-static-canary` with Static Assets and `ADMIN_API` service binding.
4. Add Access coverage before exposing admin asset:
   - `toen-static-canary.stijnvh.workers.dev/admin*`
   - `toen-static-canary.stijnvh.workers.dev/api/admin/*`
5. Keep public article, archive, media, search, and classroom paths outside Access.

### Builds API

Create one user-scoped API token. Required scope:

- Workers Builds Configuration — Edit
- no Workers Scripts — Read at runtime because IDs are preconfigured
- no account-wide script edit beyond Cloudflare-managed build token

Configure canary trigger from `config/release-trigger.v1.json`:

- build: `pnpm release:build`
- deploy: `pnpm release:activate`
- app repository/root fixed
- automatic push behavior disabled or excluded; manual exact `commit_hash` only
- exact trigger UUID, Worker tag, account ID, approved application SHA
- `TOEN_RELEASE_ACTIVATION_APPROVED=1`
- content repository and `canary-static-v1` branch

Build token and user token remain separate.

## Data sets

### A — baseline

Current four approved events. Build exact app/content SHAs. Record release ID, build UUID, static tree digest, public version ID, and active deployment ID.

### Scale — 5,000 events

Synthetic, non-sensitive catalog generated from benchmark fixture with:

- 5,000 unique slugs;
- BCE/CE range;
- 8 representative topics;
- Beat V2 classroom payloads;
- bounded sources/body sizes;
- no new image binaries.

Media worst case remains separately enforced 5,000-file projection. Do not create artificial duplicate public media renditions.

### B — controlled delta

From A, add one event, change one event, and delete one synthetic event. Expected:

- new exact content SHA and release ID;
- changed search/facets/static HTML only where expected;
- deleted URL true `404`;
- old open tab remains internally consistent until refresh;
- no mixed A/B search, page, media, or manifest revision.

## Execution phases

### Phase 0 — read-only snapshot

Commands:

```bash
pnpm exec wrangler versions list --name toen --json
pnpm exec wrangler deployments status --name toen --json
pnpm exec wrangler deployments list --name toen --json
```

Record Access app/policy IDs, service bindings, secret names/scopes, trigger/build-token IDs, and zero custom domains. Do not retrieve secret values.

### Phase 1 — clean reproducibility

From separate clean checkouts:

```bash
TOEN_CONTENT_DIR=<clean-content-checkout> pnpm ci:build
pnpm benchmark:search
pnpm benchmark:static --events=5000
pnpm benchmark:admin
```

Required:

- app and content verification green;
- static files at most 16,000 target and 18,000 hard stop;
- search raw at most 2.5 MiB, Brotli at most 750 KiB;
- search warm p95 below 50 ms under 4× throttle;
- admin package below 1 MiB gzip and preview CPU p95 below 5 ms;
- no Markdown/RSC/segment sidecars in static output;
- byte-identical rebuild from same SHAs.

### Phase 2 — protected admin first

**Mutation.** Upload/deploy private admin service. Verify no workers.dev/preview URL exists. Then create Access coverage and public canary service binding before serving `admin.html`.

Unauthenticated requests must redirect at Access. Valid Access request with absent/invalid internal JWT must still fail. Verify origin/type/length/stream/depth/node/unknown-field rejection and `no-store`.

### Phase 3 — A activation

**Mutation.** Configure exact mode and trigger A using application `commit_hash`. Verify:

1. event commit SHA returned;
2. conditional activation lock acquired;
3. build UUID returned and lock bound;
4. immutable request record contains exact app/content SHAs;
5. build checks out exact content SHA;
6. receipt tree digest matches uploaded Static Assets;
7. one public Worker version is created;
8. status moves `building` → `activated` only after deploy;
9. previous canary version remains rollback target.

### Phase 4 — 5k validation

Measure through canary hostname:

- Static Assets bypass Worker for valid files;
- public router executes only `/api/admin/*` and misses;
- cold/warm article, archive, media, Worker search, and classroom requests;
- 390×844, 834×1112, 1440×1000, and 1920×1080 journeys;
- reduced motion, keyboard, touch, wheel, 200% reflow;
- article canonical/OG/Article/LearningResource JSON-LD;
- classroom `noindex,follow`, article canonical, absent from sitemap;
- sitemap/robots and true 404;
- browser memory, main-thread long tasks, search p95;
- changed-asset upload counts and Free usage;
- no runtime GitHub, R2, KV, D1, Images transforms, Queue, or Durable Object request.

### Phase 5 — B and supersession

**Mutation.** Publish B delta twice in controlled overlap.

Expected:

- Git conditional lock permits only one queued/running owner;
- second publication returns `committed`/build-in-progress or waits for terminal owner;
- stale build cannot activate;
- unchanged retry creates no duplicate event commit;
- B activation produces one version and exact receipt;
- A remains available.

### Phase 6 — A→B→A rollback

**Mutation.** Record active B and known-good A version IDs. Roll back canary only to A. Verify 100% A traffic, A search/page consistency, Access/admin behavior, and logs. Do not change content branch during Worker rollback.

Then optionally rebuild A exact SHAs to prove reproducibility without moving branch.

## Stop conditions

Stop immediately. Do not activate or roll back further when any condition occurs:

- app/content SHA mismatch;
- correlation request or activation lock absent/tampered;
- dirty checkout;
- static tree digest mismatch;
- file/size/CPU/search budget failure;
- extra Worker version or unexpected dynamic request;
- Access gap or internal JWT bypass;
- secret/binding parity mismatch;
- stale/superseded build starts deployment;
- mixed release IDs across HTML/search/media;
- unexpected production service change;
- Cloudflare/GitHub API shape differs from tested strict schemas;
- rollback target or control-plane snapshot is incomplete.

## Evidence

Save each artifact immutably or by checksum. Include:

- A/B app and content SHAs;
- build UUIDs, release IDs, receipts, tree digests;
- Worker version/deployment IDs;
- trigger and Access snapshots without values/tokens;
- Wrangler upload changed/unchanged counts;
- 5k build/search/admin reports;
- Playwright reports and screenshots;
- HTTP headers/status matrix;
- logs for trigger, supersession, activation, failure, and rollback;
- Free-tier file/byte/request/CPU totals;
- residual risk register.

Canary completion does not authorize production cutover.
