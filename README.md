# Toen.

Toen. is a source-backed history application for Flemish secondary education. Cloudflare Workers Static Assets serve its public site. A small public router forwards protected admin APIs to a private native Worker.

Public experience recommends historical events, renders sourced articles, and provides teacher-led 5–12 minute interactive history beats.

## Product documentation

- [Interactive history beats: v1 product contract](docs/interactive-beats-v1.md)
- [Interactive history beats: V1 implementation](docs/interactive-beats-implementation.md)
- [Classroom pilot](docs/classroom-pilot.md)
- [Implementation baseline](docs/implementation-baseline.md)
- [Event authoring redesign](docs/admin-authoring-redesign.md)
- [Content publishing](docs/content-publishing.md)
- [Static-first 5,000-event benchmark](docs/architecture/static-first-5k-benchmark.md)
- [Release artifacts v1](docs/architecture/release-artifacts-v1.md)
- [Browser search v1](docs/architecture/browser-search-v1.md)
- [Static media v1](docs/architecture/static-media-v1.md)
- [Static public site v1](docs/architecture/static-public-v1.md)
- [Admin SPA and Worker v1](docs/architecture/admin-worker-v1.md)
- [Exact-SHA release pipeline v1](docs/architecture/exact-release-v1.md)
- [Static production cutover](docs/architecture/static-production-cutover-2026-08-17.md)
- [Cloudflare routing topology](docs/architecture/cloudflare-routing-topology.md)

## Teacher flow

1. Find an activity on homepage.
2. Open its preparation screen and choose 5, 8, or 12 minutes.
3. Present it with buttons, keyboard, wheel, or touch gestures.
4. Use physical response methods; Toen. stores no student identity or answers.
5. Return to preparation with **Opnieuw**, or close presentation with top-right control.

Editors use Access-protected `/admin`. They write or import a draft, verify sources and claims, preview production article and classroom views, then confirm publication explicitly. ChatGPT output never publishes automatically.

## Architecture and ownership

Application repository owns Next.js UI, strict runtime validation, admin workflow, publication service, local licensed imagery, and Cloudflare Worker configuration. Dedicated `toen-content` repository owns canonical event Markdown and mirrored catalog validation. Builds resolve exact clean application and content commits, validate them, generate deterministic release artifacts, and stage checksum-verified search assets. Runtime requests never fetch content from GitHub. Production emits public HTML and protected admin SPA without Markdown or RSC sidecars. Native private admin Worker validates Access JWTs internally and receives API requests through service binding.

Publication validates Cloudflare Access identity, and GitHub credentials never enter browser. Production publishing currently runs in dry-run mode. Enabling GitHub writes or exact Cloudflare Builds requires separate configuration and approval. See [content publishing](docs/content-publishing.md) and [release hardening](docs/release-hardening.md).

OpenNext remains a local compatibility and rollback build target. Read its Cloudflare documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server with published content:

```bash
pnpm dev
```

When `toen-content` is checked out beside this repository, use its current files—including uncommitted edits—without fetching or installing another checkout:

```bash
pnpm dev:local
```

`TOEN_CONTENT_DIR` is resolved from the application root. Local content is verified before it is copied into generated content directory. Development also creates a marked development search artifact, content-hashed browser Worker, and verified content-addressed media assets. CI and production leave this variable unset, verify immutable Git revisions, and reject development search artifacts.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Build verified shadow Static Assets output with:

```bash
pnpm build:static
```

Start with `src/app/page.tsx`. Next.js reloads development page after edits.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
pnpm preview
```

## Test

Run unit and browser journeys:

```bash
pnpm test
pnpm test:e2e
```

Browser journeys build current OpenNext Worker with immutable content revision pinned in `scripts/test-e2e.sh`. They generate explicit development-only search assets before build. Set `TOEN_CONTENT_SHA` to test another canonical content checkpoint. For local cross-repository changes, run `TOEN_CONTENT_DIR=../toen-content pnpm test:e2e` instead.

Playwright starts an isolated local Wrangler server by default. Set `TOEN_E2E_REUSE_SERVER=1` only when you intentionally want to reuse a server on `http://localhost:8787`. CI always starts an isolated server. Feature tests never use Cloudflare Access login or production routes.

## Deploy

Follow [release hardening runbook](docs/release-hardening.md). Build and inspect package before any production mutation:

```bash
pnpm ci:build
pnpm exec wrangler deploy --dry-run --strict
```

Production deploy and rollback require explicit operator confirmation. Do not deploy from an unreviewed dirty worktree.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
