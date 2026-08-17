# Content publishing

## Current migration phase

The dedicated content repository stores and validates the canonical Markdown catalog. Before verification or a build, the application resolves its `main` branch once, checks out that exact immutable commit, runs the content repository validation, and generates the local `content/events` directory. Runtime requests never fetch from GitHub.

The current new-event publisher writes canonical Markdown directly to the configured content branch. Missing files are created and identical retries do not create duplicate commits. A differing existing file returns a conflict instead of overwriting content; safe edits need a future edit flow carrying the expected content revision. After each successful reconciliation, the Worker calls a vaulted Cloudflare Deploy Hook.

A successful commit with a failed hook call is reported as partial success. The editor can retry safely: the publisher recognizes unchanged Markdown and retries only the deployment trigger. Concurrent differing edits return a conflict instead of overwriting content. Infrastructure migration remains incomplete until the replacement GitHub App, vault value, and Deploy Hook are configured.

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
- The GitHub App writes only canonical content paths.

## Publish flow

1. The editor reviews the canonical Markdown preview.
2. The Worker validates the content request.
3. The Worker gets a short-lived GitHub App installation token.
4. The GitHub App commits the Markdown file to the default content branch.
5. A Cloudflare Deploy Hook starts an application build. Rapid commits may coalesce to the latest content snapshot.
6. The build resolves the content branch once and checks out that exact commit SHA.
7. The build validates the complete content catalog and records the application and content revisions.
8. The build deploys the Worker only when all checks pass.

A failed deployment must keep the previous Worker version active. The admin interface currently shows the content commit and whether deployment triggering succeeded; build-result reporting remains future work.

## Runtime behavior

The Worker must not fetch historical content from GitHub during a request. The build must bundle the validated Markdown files. This keeps public requests fast and makes each deployment reproducible.

## Repository ownership

Application repository owns code, local curated imagery, Worker configuration, publication validation, and deployment pipeline. `toen-content` owns canonical event Markdown and its matching strict schema. Keep schema fixtures in parity until shared package has lower maintenance cost than duplication.

GitHub App installation must include only `toen-content` with `contents: write` and `metadata: read`. It must not have write access to application repository. Secrets Store bindings must use `workers` scope and remain unavailable to browser.

## Release procedure

Before granting editor access or enabling live publication:

1. Verify GitHub App repository selection and minimum permissions.
2. Verify Access covers `/admin*` and `/api/admin/events/*`.
3. Verify Worker also validates Access JWT for publication route.
4. Verify nine expected Secrets Store bindings exist and have `workers` scope. Do not retrieve or print values.
5. Set and record exact content revision used by build.
6. Run application and content verification.
7. Run Wrangler package dry-run and inspect bindings.
8. Deploy only after explicit operator confirmation.
9. Verify public pages, protected routes, publication mode, logs, and active deployment.
10. Perform one controlled publication with non-sensitive test event or approved real content.
11. Verify editor attribution, content commit, Deploy Hook, build result, and rendered event.
12. Record rollback target before declaring release complete.

Use [release hardening runbook](release-hardening.md) for commands and evidence fields.
