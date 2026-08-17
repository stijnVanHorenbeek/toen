# Toen.

Toen. is a source-backed history application for Flemish secondary education. It runs on Next.js through OpenNext on Cloudflare Workers.

Current public experience recommends historical events and renders sourced articles. Next product direction adds teacher-led, 5–12 minute interactive history beats.

## Product documentation

- [Interactive history beats: v1 product contract](docs/interactive-beats-v1.md)
- [Interactive history beats: V1 implementation](docs/interactive-beats-implementation.md)
- [Classroom pilot](docs/classroom-pilot.md)
- [Implementation baseline](docs/implementation-baseline.md)
- [Event authoring redesign](docs/admin-authoring-redesign.md)
- [Content publishing](docs/content-publishing.md)

## Teacher flow

1. Find an activity on homepage.
2. Open its preparation screen and choose 5, 8, or 12 minutes.
3. Present it with buttons, keyboard, wheel, or touch gestures.
4. Use physical response methods; Toen. stores no student identity or answers.
5. Return to preparation with **Opnieuw**, or close presentation with top-right control.

Editors use Access-protected `/admin`. They write or import a draft, verify sources and claims, preview production article and classroom views, then confirm publication explicitly. ChatGPT output never publishes automatically.

## Architecture and ownership

Application repository owns Next.js UI, strict runtime validation, admin workflow, publication service, local licensed imagery, and Cloudflare Worker configuration. Dedicated `toen-content` repository owns canonical event Markdown and mirrored catalog validation. Builds resolve one immutable content commit, validate it, and bundle it into Worker; runtime requests never fetch content from GitHub.

Publication validates Cloudflare Access identity, and GitHub credentials never enter browser. GitHub App may write only canonical content repository. Deploy Hook rebuilds application from committed content. See [content publishing](docs/content-publishing.md) and [release hardening](docs/release-hardening.md).

Read OpenNext Cloudflare documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server with published content:

```bash
pnpm dev
```

When `toen-content` is checked out beside this repository, use its current files—including uncommitted edits—without fetching or installing another checkout:

```bash
pnpm dev:local
```

`TOEN_CONTENT_DIR` is resolved from the application root. Local content is verified before it is copied into the generated content directory. CI and production leave this variable unset and continue to fetch and verify an immutable Git revision.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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

Browser journeys build current OpenNext Worker with the immutable content revision pinned in `scripts/test-e2e.sh`. Set `TOEN_CONTENT_SHA` to test another canonical content checkpoint. For local cross-repository changes, run `TOEN_CONTENT_DIR=../toen-content pnpm test:e2e` instead.

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
