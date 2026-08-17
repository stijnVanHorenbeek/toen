# Static production cutover — 2026-08-17

## Decision

Operator waived separate canary because production has one developer-user. Approved scope covered both repository merges, production Static Assets and private admin deployment, smoke checks, and rollback on mismatch.

Exact release and live publication were excluded. Admin publication remains dry-run.

## Revisions

- Application `main`: `2291166fd53d10cc7c8c0c98f37cade7c1243fcd`
- Content `main`: `9a9ea374431687514e2bb80c61cc1dbb95b3bf24`
- Application pull request: `https://github.com/stijnVanHorenbeek/toen/pull/4`
- Required `verify` check: passed in 5m13s
- Static tree SHA-256: `9681cc87d529c130de0711b91bee56ed6ad4127d624b7669c7ffb108e3d6851c`

Content reader reached `main` before application writer. Application direct push was rejected by branch protection, so reviewed commits merged through required pull request with rebase strategy.

## Build

Clean main checkouts ran:

```bash
TOEN_CONTENT_DIR=../toen-content pnpm ci:build
```

Results:

- 314/314 unit tests;
- Biome and TypeScript passed;
- 4 verified events;
- 4 immutable WebP files, 914,702 bytes;
- 52 static files and 23 HTML files;
- admin source bundle 910,497 bytes raw and 255,036 bytes gzip;
- admin Wrangler package 1,280,279 bytes raw and 298,595 bytes gzip;
- both production Wrangler dry-runs passed;
- app and content worktrees remained clean.

## Deployment

### Private admin

- Worker: `toen-admin`
- Version: `c76ec211-6724-4b00-a1d3-be4969e6297a`
- Deployment: `307aacae-1660-4df4-9e8b-ca39f855db03`
- Startup: 68 ms
- Public workers.dev request: `404`
- Bindings: Access team domain and Access audience only

No GitHub, Deploy Hook, or exact-release binding is attached. Missing publish-mode binding defaults to dry-run.

### Public static

First static version `18577132-8a32-4a43-8864-b3a8ad7a355b` uploaded 43 new or changed assets and reused 8. Automated smoke rolled back because test expected wrong archive copy. Deployment itself had served tested routes correctly before that local assertion. Rollback restored OpenNext version `d0362db7-0846-441d-8e8c-2313503c26d7` at 100%.

Corrected smoke predicate and second deployment reused all uploaded assets:

- Worker: `toen`
- Version: `0ba781ef-bc43-45d1-886b-571c3b400b04`
- Deployment: `a2b8211e-376a-4a96-9d00-89ef966f3e67`
- Startup: 5 ms
- Public host: `https://toen.stijnvh.workers.dev`
- Bindings: `ADMIN_API` to `toen-admin`, plus Static Assets

## Live validation

HTTP checks passed:

- homepage `200`;
- Apollo article `200` with JSON-LD;
- Apollo classroom route `200` with `noindex,follow`;
- archive `200`;
- sitemap and robots `200`;
- immutable WebP `200` with WebP content type and immutable cache policy;
- hashed search Worker `200` with immutable cache policy;
- unknown path `404`;
- `/admin` and `/api/admin/events/preview` redirect to Cloudflare Access;
- private admin workers.dev host returns `404`.

Headless Chromium at 390×844 opened production homepage, loaded lazy Web Worker search, found Apollo, navigated to article and classroom, started classroom deck, and reported zero console or page errors.

## Rollback

Known rollback target remains:

```text
d0362db7-0846-441d-8e8c-2313503c26d7
```

Rollback restores Worker version only. It does not delete private `toen-admin`, uploaded asset blobs, Git commits, Access configuration, or Secrets Store entries.
