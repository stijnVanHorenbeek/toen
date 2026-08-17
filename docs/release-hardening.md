# Interactive beat release hardening

## Status

Engineering validation complete on 2026-08-12. Production release not complete.

Current production serves public articles and protects admin routes.

However, `/events/apollo-11-1969/play` returns `404`.

Do not claim interactive beats are deployed until production checks below pass.

Classroom pilot remains separate release dependency.

## Safety boundary

Production deploy, content publication, secret mutation, Access policy change, and rollback are irreversible operator actions.

Run these actions only after explicit confirmation.

Never print secret values. Inventory names, scopes, status, and binding parity only. Never deploy from unreviewed dirty worktree.

## Release inputs

Record before deployment:

| Input | Value |
| --- | --- |
| Application commit | |
| Content commit | |
| Worker version before deploy | |
| Worker version after deploy | |
| Cloudflare build UUID | |
| Release receipt SHA-256 | |
| GitHub App installation checked | Yes / no |
| Access route coverage checked | Yes / no |
| Secrets Store binding parity checked | Yes / no |
| Pilot disposition | |
| Operator | |
| Date | |

Application and content commits must be immutable 40-character SHAs.

Production build must use approved content SHA.

Do not use moving branch.

## Pre-deploy checks

### Application repository

```bash
pnpm ci:build
pnpm exec wrangler types --check --env-interface=CloudflareEnv ./cloudflare-env.d.ts
pnpm exec wrangler deploy --dry-run --strict
pnpm exec wrangler check startup --worker <DRY_RUN_BUNDLE>
```

### Content repository

```bash
pnpm verify
```

### Browser matrix

- `390×844` and `430×932` mobile;
- `834×1112` tablet;
- `1440×1000` desktop;
- `1920×1080`, `1280×720`, and `1024×576` projector;
- 200% zoom-equivalent reflow width;
- keyboard, touch, wheel, and reduced motion.

### Failure journeys

- clipboard denial;
- malformed and stale ChatGPT responses;
- legacy article-only events;
- browser-storage failure;
- delayed preview or publication;
- content conflict;
- dry-run;
- partial deployment;
- incomplete AI review.

## Read-only production inventory

Commands

```bash
pnpm exec wrangler deployments status --name toen --json
pnpm exec wrangler deployments list --name toen --json
pnpm exec wrangler versions list --name toen --json
pnpm exec wrangler secrets-store secret list <STORE_ID> --remote
```

Verify:

- active deployment sends 100% traffic to one known version;
- at least one known-good rollback version remains available;
- all configured secret names are active with `workers` scope, including six exact-release settings when exact mode is enabled;
- dry-run package lists same Secrets Store binding set;
- dry-run package lists expected assets, images, and service bindings;
- observability is enabled with explicit sampling;
- source maps are uploaded.

Do not use `wrangler rollback` during inventory. It immediately creates active deployment.

## Access checks

Without authentication, verify public routes stay public and protected routes redirect to Access:

```bash
curl -I https://toen.stijnvh.workers.dev/
curl -I https://toen.stijnvh.workers.dev/events/apollo-11-1969
curl -I https://toen.stijnvh.workers.dev/admin
curl -I https://toen.stijnvh.workers.dev/api/admin/events/preview
curl -I https://toen.stijnvh.workers.dev/api/admin/events/publish
curl -I https://toen.stijnvh.workers.dev/api/admin/releases/status
```

Expected:

- homepage and public event routes return public success responses;
- `/admin*` and `/api/admin/*` redirect unauthenticated requests to Access;
- publication route validates `Cf-Access-Jwt-Assertion`, issuer, audience, and email inside Worker;
- unrelated public API paths are not accidentally covered.

## Deployment

After explicit confirmation:

1. Confirm exact release request contains reviewed application and content SHAs.
2. Run build command `pnpm release:build` through approved Cloudflare trigger.
3. Confirm build receipt, newest-build ownership, and expected Static Assets inventory.
4. Run deploy command `pnpm release:activate` only through approved trigger.
5. Record build UUID, receipt hash, new Worker version, and deployment IDs.
6. Open public homepage, one article, and each classroom mechanic.
7. Verify `/admin` through Access with authorized editor.
8. Inspect Workers Logs for exceptions or binding failures.
9. If any blocker appears, stop.
10. Verify active deployment is expected version at 100% traffic.

## Controlled publication

After explicit confirmation and only when live mode is verified:

1. Open approved event draft through `/admin`.
2. Review canonical article and classroom preview.
3. Complete every source and AI claim decision where applicable.
4. Confirm publication.
5. Verify content commit path, editor attribution trailer, and GitHub App author.
6. Verify Builds API request pins approved application SHA and returns build UUID.
7. Verify UUID-keyed content record pins returned content commit SHA.
8. Verify admin reports `building`, then `activated` only after successful deploy.
9. Verify production renders event and receipt matches active build.
10. Verify unchanged retry creates no duplicate event commit and supersedes stale build safely.

Successful content commit with failed trigger/correlation is `committed` partial success. It is not failed content publication. Retry exact build without recreating or overwriting event content. Trigger acceptance alone remains `building`, not activation.

## Rollback

Rollback is production mutation. Get explicit confirmation first.

1. Identify last known-good version from recorded deployment inventory.
2. Confirm its bindings still exist and match current resource contracts.
3. Run `pnpm exec wrangler rollback <VERSION_ID>`.
4. Verify active deployment changed to selected version at 100% traffic.
5. Verify public routes and Access-protected routes.
6. Record reason, old version, rollback version, time, and verification result.

Worker rollback does not roll back content repository or connected resources.

If content caused failure, restore approved content commit separately.

Then trigger rebuild and record both actions.

## Observability

Workers Logs retain sampled request logs according to `wrangler.jsonc`.

Publication failures emit structured `admin_event_publish_failed` events.

Events do not contain content, credentials, or pasted ChatGPT text.

During release, monitor:

- Worker exceptions;
- Access configuration failures;
- publication configuration failures;
- GitHub conflicts and upstream failures;
- Deploy Hook partial success;
- unexpected 4xx/5xx changes on public routes.

## Release decision

Release is complete only when:

- target teacher pilot has disposition;
- reviewed commits are committed and deployed;
- production classroom routes pass;
- one controlled live publication and rendered deployment pass;
- rollback target and operator procedure are verified;
- no blocker remains.

Until then, describe state as engineering-validated, not shipped.
