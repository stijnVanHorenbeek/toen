# Implementation baseline before interactive beats

Status: reconciled for prototype work on 2026-08-11

## Scope

This baseline preserves current admin redesign and incomplete publishing migration. It does not claim that live publication, rollback, or failure recovery has been exercised end to end.

No merge, cherry-pick, commit, deployment, publication, secret change, or production rollback was performed while establishing this baseline.

## Repository baseline

### Application repository

| Ref | Commit | Tree |
| --- | --- | --- |
| `feat/admin-authoring-flow` / `origin/feat/admin-authoring-flow` | `b32525ca2b75fe551d8bc2e65de65d7fe859074e` | `0469a2737109b1ca66f73a92860054078a6a5f42` |
| `origin/main` | `33422d452d2d4daeffc8fd95295c58207a0c88ba` | `0469a2737109b1ca66f73a92860054078a6a5f42` |
| merge base | `873af66a0438d3693393cff3b57981fa37a12279` | `31227834613f7282b343e7c0da0dfcfb24c772bd` |

Branch commit IDs diverge, but committed trees are identical and Git identifies branch-tip patches as equivalent. Merging or cherry-picking admin redesign would add ancestry without changing files and risks later confusion.

Current application working tree is intentionally not empty. It contains only known planning changes in `.gitignore`, `README.md`, and `docs/`. Content synchronization and builds produced no additional tracked changes. These planning changes must remain intact until user approves a commit or another disposition.

### Content repository

| Ref | Commit | Tree |
| --- | --- | --- |
| `fix/content-validation-parity` / `origin/fix/content-validation-parity` | `e131151fdf42cee9c5037518dead163465481b8f` | `bf50bfbcd59899c9ee5b73c71e66089cdcc3404f` |
| `origin/main` | `6477e746ca1522420dc50932b6cc4febf692bfd3` | `bf50bfbcd59899c9ee5b73c71e66089cdcc3404f` |
| merge base | `aed1d82cc9b9df4fb3fea0ff8dc84d7a19be9f1b` | — |

Content branch-tip patches are also equivalent. Content repository is clean. Application content sync resolved `origin/main` to `6477e746ca1522420dc50932b6cc4febf692bfd3`.

## Branch strategy

Approved implementation work:

1. Application branch `feat/interactive-history-beats-v1` starts directly from canonical `origin/main` commit `33422d452d2d4daeffc8fd95295c58207a0c88ba` and carries preserved planning changes.
2. Do not merge or cherry-pick `feat/admin-authoring-flow`; required redesign already exists in base tree.
3. When canonical beat fields become necessary, branch content work directly from `origin/main` commit `6477e746ca1522420dc50932b6cc4febf692bfd3`. Do not merge or cherry-pick `fix/content-validation-parity`.
4. Keep application and content changes serial, with one writer and matching schema tests before canonical content changes.

## Verification baseline

| Check | Result |
| --- | --- |
| Application `pnpm verify` | Passed: 15 Vitest files, 85 tests, Biome, TypeScript |
| Content `pnpm verify` | Passed: 1 Vitest file, 38 tests, Biome, TypeScript, 4 event documents validated |
| Next production build | Passed with Next.js 16.2.11 |
| OpenNext Worker build | Passed with `@opennextjs/cloudflare` 1.20.2 |
| Playwright-BDD | Passed: 38 browser scenarios |

Content validation emitted Node's `DEP0205` deprecation warning for `module.register()`. It did not fail verification.

## Production configuration evidence

Verified without reading or displaying secret values:

- Cloudflare Access application `Toen Admin` exists for `toen.stijnvh.workers.dev/admin*` with one allow policy using an email selector.
- Unauthenticated requests to `/admin`, `/api/admin/events/preview`, and `/api/admin/events/publish` all redirect to Cloudflare Access. Public homepage and event routes remain reachable. Unrelated `/api/other` does not redirect.
- Preview route still has no application-level authentication wrapper. Its protection depends on external Access route coverage, which direct production requests currently confirm.
- Current Worker has all nine expected Secrets Store bindings. Store contains all nine matching secret names.
- One deploy hook named `Content published` targets `main`. Workers Builds reports eight completed records with successful outcomes.
- Worker has ten retained deployments/versions, so a rollback target exists.
- Locally configured GitHub App installation uses selected-repository scope, includes only `toen-content`, and has `contents: write` plus `metadata: read`. Configured content branch is `main`.
- Unit tests cover Access JWT validation, fail-closed configuration, create-only GitHub writes, conflict reconciliation, editor attribution trailer, Deploy Hook failure, safe retry, and dry-run behavior.

## Explicit production unknowns

- Secrets Store metadata proves names and bindings, not current secret values. Production values were not retrieved or compared with local configuration.
- Production `GITHUB_PUBLISH_MODE` value was not read. Live versus dry-run mode remains unknown.
- GitHub App scope was verified against local configured credentials. Production vault references could not be proven identical without reading secret values.
- No app-authored production content commit exists yet, so editor attribution has only automated-test evidence.
- Deploy Hook history shows successful builds, but no new hook was triggered during this check.
- Retained Worker versions make rollback possible, but rollback and restoration were not exercised.
- Partial commit/deploy failure and retry behavior is automated-test verified, not production fault-injection verified.
- Build-result reporting still stops after queued/failed trigger state in admin.

These unknowns block claims that production publishing migration is complete. They do not block paper or isolated clickable mechanic prototypes.

## Approved V1 direction

User approved full creator V1 on 2026-08-11. [Interactive history beats: V1 implementation](interactive-beats-implementation.md) records selected mechanics, fixed interaction contracts, domain/runtime decisions, creator scope, and serial delivery plan.

Selected first-wave mechanics:

- vote → evidence → revote;
- source duel;
- context-bound decision.

Vote → evidence → revote is first runtime slice. Full creator scope includes constrained admin editing and manual consumer-ChatGPT copy/paste after runtime, curated content, and homepage milestones. Pilot evidence still gates effectiveness claims.
