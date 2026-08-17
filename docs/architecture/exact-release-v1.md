# Exact-SHA release pipeline v1

## Decision

Toen uses Cloudflare Workers Builds REST API for exact application revisions. Deploy Hooks remain legacy fallback until reader-first rollout and approved control-plane configuration complete.

Exact pipeline requires new user-scoped API token with only **Workers Builds Configuration — Edit**. Runtime does not need **Workers Scripts — Read** because account ID, trigger UUID, and Worker tag are preconfigured. Token creation, Secrets Store writes, trigger changes, build-token changes, uploads, and deployments remain approval-gated.

## Why Deploy Hooks are insufficient

Deploy Hook is tied to branch and accepts POST without exact content metadata. Hook acceptance only means build request was accepted. It does not prove exact content checkout, build success, Worker version creation, or activation.

Workers Builds API accepts exact application `commit_hash` and returns build UUID. Toen correlates returned UUID with exact content SHA through immutable Git record.

## Publication flow

Exact mode stays disabled until `RELEASE_PIPELINE_MODE=exact` and complete configuration are available.

1. Validate editor Access JWT, origin, request bounds, and canonical event.
2. GitHub App writes or reconciles event Markdown in content repository.
3. Record returned content commit SHA.
4. Acquire integrity-checked `.toen/releases/activation-lock.json` through conditional Git blob SHA update.
5. Refuse concurrent trigger while live lock owns queued/running build.
6. Trigger Cloudflare build with configured exact application SHA only.
7. Bind lock to returned build UUID.
8. GitHub App writes `.toen/releases/requests/<build-uuid>.json` containing exact application/content SHAs and SHA-256 integrity.
9. Return `building` only after lock and correlation record succeed.
10. Admin polls protected status endpoint and reports `building`, `activated`, `failed`, or `superseded`.

Trigger or correlation failure returns `committed`. Content is not recreated. Retry safely starts new build UUID against exact current content commit.

GitHub App scope remains content repository `contents:write`; no application-repository or Actions permission is added.

## Build flow

Cloudflare trigger contract: `config/release-trigger.v1.json`.

Build command:

```bash
pnpm release:build
```

Build reads `WORKERS_CI_BUILD_UUID` and `WORKERS_CI_COMMIT_SHA`. It polls public content repository for UUID-keyed request, bounded to 30 attempts over about 60 seconds. It rejects malformed, oversized, tampered, cross-wired, or wrong-application records. Then it runs exact `ci:build` with request content SHA.

Successful build emits `.generated/release-build.json` with:

- exact request;
- deterministic release ID;
- static output file count;
- SHA-256 tree digest over every static path and byte;
- admin Worker SHA-256;
- receipt integrity SHA-256.

Release manifest and receipt use exhaustive schema allowlists. Public runtime never fetches GitHub.

## Activation flow

Deploy command:

```bash
pnpm release:activate
```

Activation requires all conditions:

- Workers Builds runtime (`WORKERS_CI=1`);
- explicit trigger environment approval (`TOEN_RELEASE_ACTIVATION_APPROVED=1`);
- exact mode and complete build configuration;
- build UUID/application SHA matching receipt;
- clean unchanged Git checkout after build;
- recomputed static tree digest matching every attested byte;
- active Git lock still owning build/content SHAs;
- current build still newest build for configured trigger.

Lock remains owned while Cloudflare build status is queued/running, so another publisher cannot trigger between activation check and deploy. Expired triggering lease recovers pre-trigger crashes. Active lock has no automatic timeout takeover: matching build must appear with terminal status. Missing history requires operator repair, never automatic activation. Superseded build exits without Wrangler deploy. Current build invokes exactly one:

```bash
pnpm exec wrangler deploy --config wrangler.static.jsonc
```

Cloudflare runs deploy command only after build command succeeds. Failed build therefore leaves active version unchanged. Newer build suppresses stale activation.

## States

- `committed`: canonical content saved; exact build or correlation did not start.
- `building`: exact request exists and build is queued, initializing, or running.
- `activated`: current build stopped with successful deploy and no newer trigger build.
- `failed`: build stopped with fail, skipped, cancelled, or terminated outcome, or metadata does not match configured exact SHA.
- `superseded`: newer build for same trigger exists; stale activation is blocked.

Legacy `committed-and-triggered` remains readable while migration mode is `legacy`. Exact writer never maps trigger acceptance to activation.

## Reader-first rollout

1. Commit content validator that accepts and validates optional request directory and activation lock.
2. Commit application readers, status UI, build scripts, and legacy-default mode.
3. Push content reader before application writer.
4. Create scoped Builds token and Secrets Store entries only after review/approval.
5. Configure production trigger exact build/deploy commands and environment.
6. Deploy reader/admin version while mode remains `legacy`.
7. Verify canary exact build and status polling.
8. Set mode to `exact` only after canary and rollback evidence.
9. Remove Deploy Hook fallback in later cleanup.

## Configuration

Admin Worker future bindings:

- `RELEASE_PIPELINE_MODE_STORE`
- `CLOUDFLARE_BUILDS_API_TOKEN_STORE`
- `CLOUDFLARE_ACCOUNT_ID_STORE`
- `CLOUDFLARE_BUILD_TRIGGER_UUID_STORE`
- `CLOUDFLARE_WORKER_TAG_STORE`
- `RELEASE_APPLICATION_SHA_STORE`

Build trigger receives equivalent direct environment variables. Builds token used by Cloudflare deploy command remains separate Cloudflare-managed token.

## Validation boundary

Local tests cover:

- exact commit hash in trigger request;
- trigger failure after successful content commit;
- correlation write failure;
- conditional Git activation lock ownership and stale lease recovery;
- duplicate retry with distinct immutable UUID paths;
- integrity tampering and cross-wired application SHA;
- request polling, independent streamed size limits, and symlink containment;
- state mapping for building/activated/failed/superseded;
- stale-build activation suppression without trigger/deploy TOCTOU;
- exact static tree-byte attestation and clean checkout recheck;
- activation refusal outside approved Workers Build;
- legacy reader compatibility;
- strict status API and UI transition from building to activated.

No local test calls Cloudflare or GitHub production APIs. Canary must verify user-token scope, first status latency, trigger environment snapshot, exact content checkout, one-version activation, supersession, and A→B→A rollback before production cutover.
