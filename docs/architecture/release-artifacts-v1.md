# Release artifacts v1

## Purpose

Release projection converts verified canonical Markdown into deterministic, bounded build inputs. Git Markdown remains authoritative. Generated files never write into canonical content and never become another editing source.

Release ID is SHA-256 over fixed namespace, schema version, application SHA, and content SHA. Same clean inputs produce byte-identical files. Artifacts contain no timestamp.

## Input attestation

`pnpm content:project` requires:

- Clean application checkout at immutable 40-character lowercase Git SHA
- Separate clean content Git checkout at immutable 40-character lowercase Git SHA
- Content read only from `<content checkout>/content/events`
- Optional expected app/content SHAs matching resolved Git revisions
- Canonical real paths that do not overlap through direct or symbolic links
- Output confined to application checkout `.generated` tree

Generator does not trust ignored synchronized copies or `content/revision.json`. It refuses dirty, aliased, nested, cross-wired, mismatched, or unsafe-output checkouts. Content is extracted with `git archive` from resolved commit SHA, so worktree mutation after cleanliness check cannot alter projected bytes. It reads at most 16 snapshot documents concurrently, installs immutable release tree, and atomically switches small `release.json` pointer.

## Paths and delivery

| Path | Role | Delivery |
| --- | --- | --- |
| `release.json` | Build pointer and manifest checksum | Build-only |
| `releases/<releaseId>/manifest.json` | Content-projection inventory | Build-only |
| `releases/<releaseId>/events/<slug>.json` | Full safe event input for HTML generation | Build-only |
| `releases/<releaseId>/media.json` | Deduplicated media provenance and renditions | Build-only |
| `releases/<releaseId>/search.json` | Lazy browser search input | Public |
| `releases/<releaseId>/facets.json` | Initial filters and archive input | Public |

`selectPublicReleaseFiles()` is independent fail-closed deploy allowlist. It returns only exact search and facets paths and rejects attempts to promote another role. Static generator later adds HTML and shared runtime assets. Deploy tooling must never copy build-only event/media/manifest files into Workers Static Assets.

At 5,000 events, content projection produced 5,005 build files but selects only search and facets for public delivery. Static generator may add up to 5,000 deduplicated WebP files. Worst-case public output is 15,409 files, including bounded static archives, below 16,000 target and 18,000 CI hard stop.

## Public event allowlist

Each event projection explicitly copies:

- Slug, title, historical date, summary, Markdown body
- Topics and visible topic labels
- Vocational profiles
- Source title, publisher, and HTTP(S) URL
- Versioned interactive beat through exhaustive nested phase/mechanic projection
- Optional trusted `mediaId`

Projection never spreads raw canonical or admin objects. Added properties such as AI review decisions, claims, draft metadata, or internal notes do not enter output.

## Media contract

Event files contain only `mediaId`. `media.json` owns display/provenance metadata and rendition list:

- Alt text, caption, credit, license, and license rationale
- Original and source URLs
- Derivative description and focal point
- Rendition path, format, width, height, and SHA-256

No-domain delivery keeps one content-addressed WebP per media ID in Static Assets. Optional private R2 build storage may change build-source paths under a later schema version, but public delivery remains static and media identity and provenance remain stable.

## Determinism and integrity

- Events, media IDs, topic IDs, object keys, and manifest entries use code-unit ordering.
- Semantic arrays preserve canonical order: topics, profiles, sources, choices, stages, and routes.
- Recursive JSON key sorting removes object insertion-order dependence.
- Every content artifact records byte length and SHA-256 in manifest.
- Search entry also records Brotli size.
- `release.json` records manifest path and SHA-256.
- Exclusive owner-token lock makes live concurrent writer fail fast. Stale lock fails closed and requires explicit removal after operator verifies no writer is active.
- Immutable release tree installs before atomic pointer switch; interruption cannot remove previous active pointer.
- Existing same-ID tree must contain no symbolic links and match every expected checksum before reuse.
- Output root and `releases` directory must be real directories; nested symbolic-link redirection fails closed.

## Limits

| Input or artifact | Limit |
| --- | ---: |
| Events | 10,000 |
| Raw Markdown document | 65,536 bytes |
| Title | 160 characters |
| Summary | 500 characters |
| Body | 20,000 characters |
| Topics, profiles, sources | 16 each |
| Source title / publisher / URL | 240 / 160 / 2,048 characters |
| Event JSON | 128 KiB |
| Search JSON | 2.5 MiB raw / 750 KiB Brotli |
| Facets JSON | 256 KiB |
| Media JSON | 8 MiB |
| Manifest JSON | 2 MiB |
| Projected final Static Assets | 18,000 files |

Projection estimates two HTML files per event, one file per referenced media ID, one topic archive per topic, 24 period archives, one archive index, and 128 shared assets. Release fails before generation when this upper bound exceeds 18,000.

Release rejects duplicate slugs, topics, profiles, source URLs, unrelated labels, conflicting cross-event labels, unsupported Markdown, unsafe URLs, oversize documents, and noncanonical filenames.

Both repositories share hashed Beat V2 fixture `tests/fixtures/release-parity-event.md`. Content repository now mirrors projection-facing limits and uses bounded catalog reads.

## Synthetic 5,000-event probe

Ad hoc local four-template build-input probe produced:

- Build files: 5,005
- Public files selected: 2
- Aggregate build-input bytes: 37,902,259
- Search: 1,890,301 raw / 7,150 Brotli bytes
- Manifest: 1,236,035 bytes

Probe used repeated documents and fake SHAs, so it is not release evidence or public payload measurement. Repeated templates compress far more than diverse catalog. Raw and Brotli hard gates execute during every real projection.

## Compatibility and rollback

Schema v1 readers accept only v1 artifacts. Schema changes require reader-first rollout and new release ID. Previous Worker version keeps its own projection, HTML, and static media. Content-addressed media remains retained until rollback window closes.

This manifest is build-input inventory, not final deploy activation manifest. Exact-SHA publication task later adds final HTML/assets, Worker version, activation status, and rollback receipt.
