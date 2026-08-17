# Content publishing

## Current migration phase

The dedicated content repository stores and validates the canonical Markdown catalog. Before verification or a build, the application resolves its `main` branch once, checks out that exact immutable commit, runs the content repository validation, and generates the local `content/events` directory. Runtime requests never fetch from GitHub.

New-event publisher can write canonical Markdown directly to configured content branch. Missing files are created, and identical retries do not create duplicate commits. Differing existing file returns conflict instead of overwriting content; safe edits need future edit flow carrying expected content revision. Production currently omits GitHub and release-pipeline bindings, so publication runs in dry-run mode. Legacy mode and vaulted Deploy Hook remain inactive.

Exact pipeline is implemented but disabled until approved configuration and controlled production validation exist. It triggers Cloudflare Builds API with exact application SHA, writes immutable build-UUID correlation record containing exact content SHA, and reports build state separately. Successful content commit with trigger/correlation failure remains partial success. Retry recognizes unchanged Markdown and starts distinct correlated build without recreating content. Concurrent differing edits still fail closed.

## Target model

A dedicated content repository stores the canonical Markdown files. Trusted editors commit content through the Access-protected admin interface. They do not need a human approval for each change.

The application repository stores the application code. The GitHub App must not have write access to this repository after the migration.

## Trust boundary

- Cloudflare Access authenticates each editor.
- The Worker validates the Access JWT before a write.
- The Worker records the editor identity with the content commit.
- The Worker validates and serializes all Markdown.
- The browser never receives GitHub credentials.
- The GitHub App installation includes only the content repository.
- The GitHub App writes only canonical event paths and validated `.toen/releases` coordination records.

## Publish flow

1. The editor reviews the canonical Markdown preview.
2. The Worker validates the content request.
3. The Worker gets a short-lived GitHub App installation token.
4. The GitHub App commits the Markdown file to the default content branch.
5. GitHub App conditionally acquires activation lock in content Git; queued/running owner blocks concurrent trigger.
6. Exact mode triggers Cloudflare build with configured immutable application SHA and receives build UUID.
7. Lock binds to build UUID; GitHub App writes integrity-checked correlation record with returned content SHA.
8. Build resolves correlation record, verifies application SHA, and checks out exact content SHA.
9. Build validates catalog, release/media/static budgets, native admin package, and hashed byte-tree receipt.
10. Deploy command rechecks clean checkout, every static byte, active lock, and newest-build ownership.
11. One public Worker version activates only after all checks pass.

Failed build leaves previous Worker version active. Newer build suppresses stale activation. Admin reports committed, building, activated, failed, or superseded state. Deploy Hook acceptance remains legacy transition signal, never exact deployment success.

## Runtime behavior

The Worker must not fetch historical content from GitHub during a request. The build must bundle the validated Markdown files. This keeps public requests fast and makes each deployment reproducible.

## Repository ownership

Application repository owns code, local curated imagery, Worker configuration, publication validation, and deployment pipeline. `toen-content` owns canonical event Markdown and its matching strict schema. Keep schema fixtures in parity until shared package has lower maintenance cost than duplication.

GitHub App installation must include only `toen-content` with `contents: write` and `metadata: read`. It must not have write access to application repository. Secrets Store bindings must use `workers` scope and remain unavailable to browser.

## Release procedure

Before granting editor access or enabling live publication:

1. Verify GitHub App repository selection and minimum permissions.
2. Verify Access covers `/admin*` and `/api/admin/*`.
3. Verify Worker validates Access JWT for publication and release-status routes.
4. Verify all legacy and exact-release Secrets Store bindings exist with `workers` scope. Do not retrieve or print values.
5. Set and record exact content revision used by build.
6. Run application and content verification.
7. Run Wrangler package dry-run and inspect bindings.
8. Deploy only after explicit operator confirmation.
9. Verify public pages, protected routes, publication mode, logs, and active deployment.
10. Perform one controlled publication with non-sensitive test event or approved real content.
11. Verify editor attribution, content commit, Deploy Hook, build result, and rendered event.
12. Record rollback target before declaring release complete.

Use [release hardening runbook](release-hardening.md) for commands and evidence fields.
