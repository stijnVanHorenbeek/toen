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

## Architecture

Published Markdown lives in dedicated `toen-content` repository. Builds resolve and validate one immutable content revision before bundling it into Worker. Publication validates Cloudflare Access identity, and GitHub credentials never enter browser. Access route coverage is verified; remaining live-publishing unknowns are recorded in the [implementation baseline](docs/implementation-baseline.md).

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

Browser journeys build current OpenNext Worker first. They default to immutable content revision `30c92b52fd76d438194c1ed155e8aa6c1f1297af`, which contains the four reviewed classroom activities; set `TOEN_CONTENT_SHA` to test another canonical content checkpoint. For local cross-repository changes, run `TOEN_CONTENT_DIR=../toen-content pnpm test:e2e` instead. Playwright reuses a local server on `http://localhost:8787` when available; GitHub Actions starts and stops its own local Wrangler server. Feature tests never use Cloudflare Access login or production routes.

## Deploy

Deploy the application to Cloudflare:

```bash
pnpm deploy
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
