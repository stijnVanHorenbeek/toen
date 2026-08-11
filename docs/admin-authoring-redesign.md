# Event authoring redesign

> This document defines current event-authoring foundation. [Interactive history beats: v1 product contract](interactive-beats-v1.md) defines next classroom and AI-assisted direction. Beat work must extend current provider, preview, validation, and publication safety rather than restore deleted legacy components.

## Goal

Replace the schema-shaped admin form with a clear authoring flow for a trusted Flemish teacher.

The public audience is 16-year-old students in vocational and technical secondary education. The interface must lower language barriers without lowering intellectual expectations.

## Product decisions

- Use Belgian Dutch (`nl-BE`) throughout the current application.
- Keep routes unprefixed and support one locale for now.
- Keep canonical content as deterministic Markdown.
- Use Lexical for a constrained visual editor.
- Infer the content slug. Do not show a slug field.
- Support exact day, month, year, circa, and BCE dates.
- Use a date field with a calendar popup for exact CE dates.
- Use direct historical controls for BCE and partial dates.
- Use fixed `Vakrichtingen` and expandable topics.
- Save one unfinished draft in browser storage.
- Require at least one source and support multiple sources.
- Show the rendered event before publication.
- Require an explicit publication confirmation.

## Non-goals

- Edit or delete published events
- Images or R2 uploads
- Multilingual content or locale routes
- Server-side drafts or cross-device recovery
- Approval roles or editorial assignments
- Full page-builder controls
- Deployment-completion reporting beyond current queued/failed states

## Language contract

### Teacher interface

Use direct and specific task language. Avoid Git, repository, slug, canonical, and Markdown terms in the main flow.

Use these main labels:

- `Nieuwe gebeurtenis`
- `Verhaal`
- `Indeling & bronnen`
- `Controleren & publiceren`
- `Vakrichtingen`
- `Onderwerpen`
- `Voorbeeld bekijken`
- `Gebeurtenis publiceren`

### Student content

Use clear standard Belgian Dutch. Keep necessary historical terms and explain them in context. Do not use forced youth language. Do not treat bso or tso as a reading-level diagnosis.

### Architecture

- Set the document language to `nl-BE`.
- Keep user-visible messages in typed locale modules.
- Keep stable IDs separate from visible labels.
- Use explicit locale formatters for numbers, sorting, and historical dates.
- Keep source titles and publisher names in their original language.
- Return stable API error codes with localized fallback messages.

Do not add locale middleware, language negotiation, or an i18n dependency until a second locale exists.

## Authoring flow

### Stage 1: Verhaal

Fields:

1. Title
2. Historical date precision
3. Historical date
4. Summary
5. Visual story editor

The visual editor supports:

- paragraphs
- heading level 2 and 3
- bold and italic text
- ordered and unordered lists
- block quotes
- links
- Markdown keyboard shortcuts

The editor serializes this controlled subset to Markdown. It does not store HTML.

### Stage 2: Indeling & bronnen

`Vakrichtingen` use these stable IDs:

- `algemeen`
- `auto-mechanica`
- `elektriciteit`
- `bouw`
- `hout`
- `metaal`
- `logistiek-transport`

Show all values as labeled multi-select choices. Require at least one value.

Topics show existing catalog values as suggestions. The editor can add a new topic through an explicit action. Normalize new topic IDs before publication and keep the visible label.

Sources use repeatable groups with title, publisher, and URL. Require one complete source. Let the editor add and remove more sources without leaving the flow.

### Stage 3: Controleren & publiceren

Show the public event rendering, including:

- formatted historical date
- title
- summary
- body
- topics
- sources

Show section-level `Wijzigen` actions. Show the inferred public URL. Put repository path and raw Markdown inside collapsed technical details only.

The first publication action opens a confirmation dialog. The dialog names the event and explains that publication saves content and starts a site update. The final button says `Gebeurtenis publiceren`.

## Historical dates

Ask precision before date values:

- `Exacte datum`
- `Maand en jaar`
- `Alleen jaar`
- `Ongeveer dit jaar`

Ask era separately:

- `n.Chr.`
- `v.Chr.`

For exact CE dates, use an `nl-BE` date control with a calendar popup and direct typing.

For exact BCE dates, use day, Dutch month, and year controls. For partial dates, show only required controls.

Reject empty values and obvious impossible month/day combinations. Do not enforce Gregorian leap-year rules on historical dates. Never require an invented day or month.

## Slug inference

Derive the slug from normalized title, year, and era. Use lowercase ASCII and hyphens. Append `bce` for BCE dates.

Example:

```text
Constantinopel valt + 1453 CE
→ constantinopel-valt-1453
```

Do not accept a browser-provided slug as authority. Derive it again during server validation and publication. Existing-content conflict handling remains create-only and fail-closed.

## Draft recovery

Store one versioned draft in `localStorage` after meaningful changes. Store field values, story Markdown, source rows, and current stage.

Show concise states:

- `Concept opgeslagen op dit apparaat`
- `Concept opslaan…`
- `Concept kon niet worden opgeslagen`

When a stored draft exists, ask whether to restore or discard it. Clear the stored draft only after successful content publication or explicit discard.

Use a navigation warning only while current changes have not reached browser storage.

## Validation

Validate when the editor continues to the next stage and before publication. Do not show red errors while the editor types.

On failure:

1. Keep all entered values.
2. Focus a linked error summary.
3. Show a specific error beside each field.
4. Connect errors with `aria-describedby` and `aria-invalid`.
5. Focus the first invalid field when the editor follows an error link.

Return stable API codes and structured field issues. Keep server validation authoritative.

Example messages:

- `Vul een titel in.`
- `Kies hoe precies de datum bekend is.`
- `Kies minstens één vakrichting.`
- `Vul een geldige URL in, bijvoorbeeld https://example.org/bron.`

## Safety invariants

Preserve these behaviors:

- A delayed validation response cannot restore stale publishable data.
- Editing validated content invalidates publication readiness.
- Two concurrent publication requests cannot start.
- A successful publication cannot repeat from the same submitted state.
- A saved commit with a failed deployment trigger remains safely retryable.
- A differing existing event returns a conflict and never overwrites content.
- Missing live configuration fails closed.
- Explicit dry-run never mutates content.

## Component shape

Use one provider as the state boundary. Expose state, actions, and metadata through a typed context. Compose stages, navigation, review, confirmation, and status as sibling components.

Keep domain conversion and validation outside presentation components. Keep the Lexical adapter responsible only for Markdown editor state.

## TDD sequence

1. Add domain tests for inferred slugs and supported date precision.
2. Add API tests for structured validation issues and inferred slugs.
3. Rewrite BDD scenarios for the three-stage flow.
4. Add failing browser scenarios for partial dates, BCE, fixed vakrichtingen, new topics, repeatable sources, recovery, rendered review, and confirmation.
5. Add the smallest domain and API changes that pass focused tests.
6. Add the state provider and each stage in small browser-driven slices.
7. Add Lexical Markdown round-trip tests before replacing the story text area.
8. Add locale messages and formatters with unit tests.
9. Preserve existing publish-safety scenarios throughout.

## Verification

Required automated checks:

- unit tests
- BDD browser journeys
- Biome
- TypeScript
- Next.js build
- OpenNext Worker build

Required direct checks:

- desktop at 1440 px
- mobile at 390 px and 430 px
- keyboard-only stage navigation and dialog
- 200% zoom without horizontal overflow
- slow preview and publish responses
- refresh and draft restoration
- screen-reader status regions stay concise
- contrast meets WCAG AA

## Acceptance

- The main flow contains no slug, Git, repository, canonical, or Markdown jargon.
- An editor can publish an exact CE event without typing a slug.
- An editor can publish month-only, year-only, circa, and BCE events without false precision.
- An editor can select fixed vakrichtingen and add a new topic.
- An editor can add, remove, and reorder multiple sources.
- The visual editor round-trips the supported Markdown subset deterministically.
- Refresh restores an unfinished local draft after confirmation.
- Validation identifies exact fields and preserves entered work.
- Review shows the real public rendering before publication.
- Publication requires explicit confirmation.
- Existing concurrency, conflict, dry-run, and partial-success protections still pass.
