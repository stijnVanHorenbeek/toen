# Interactive history beats: V1 implementation

Status: approved direction on 2026-08-11

## Scope decision

Build full creator V1 in serial milestones:

1. versioned beat domain;
2. classroom runtime and four curated activities covering three mechanics;
3. homepage launch path;
4. current admin extended for beat editing and exact classroom preview;
5. manual consumer-ChatGPT prompt/copy/paste workflow;
6. strict import recovery, source review, and existing explicit publication confirmation;
7. accessibility, projector, Worker, and publishing hardening.

Runtime and curated content come first. Admin and ChatGPT work must reuse proven runtime/domain contracts rather than define a second format.

Classroom pilot still gates claims about improved attention or learning. It does not block engineering during summer holiday.

## Research transfer

Borrow interaction grammar from attention-optimized products:

- unresolved, meaningful question;
- immediate personal commitment;
- progressive disclosure;
- contrast and visible consequence;
- bounded choice;
- rapid explanatory feedback;
- frequent state changes tied to reasoning.

Do not borrow retention machinery:

- infinite continuation or autoplay;
- variable rewards;
- majority cues before reasoning;
- speed pressure;
- individual rankings;
- streaks or return obligations;
- notification loops;
- surveillance or personal response history;
- decorative novelty.

Attention capture is not learning evidence. Every beat closes its curiosity gap and asks students to use evidence, revise, explain, or retrieve.

## V1 mechanics

All mechanics use one fixed phase engine. Content changes; classroom controls and interaction grammar stay predictable.

### Vote → evidence → revote

Purpose: test a defensible claim or decision, then reward revision after evidence.

| Time | Projected state | Teacher action | Student action |
| --- | --- | --- | --- |
| 0:00–0:20 | Historical problem and 2–4 choices, including `onzeker` | Read problem; do not explain answer | Inspect and think privately |
| 0:20–0:45 | Commitment prompt | Ask for discreet fingers, cards, mini-whiteboards, or pair commitment | Choose before discussion |
| 0:45–1:35 | Evidence 1 with source identity | Reveal and ask what changes | Find supporting or weakening detail |
| 1:35–2:35 | Peer reasoning | Ask each partner to give one reason | Compare reasons, not popularity |
| 2:35–3:25 | Evidence 2 | Reveal complication | Reassess first answer |
| 3:25–4:05 | Revision | Request private revote | Keep or change answer |
| 4:05–5:15 | Reason sampling | Ask for one changed and one unchanged explanation | Link answer to evidence |
| 5:15–6:30 | Resolution | Explain best-supported answer and tempting error | Check reasoning |
| 6:30–7:15 | Historical payoff and lesson bridge | Connect evidence to larger lesson | State one takeaway |

Five-minute exit: evidence 1 → short pair reason → revote → resolution. Twelve-minute extension: one extra evidence item plus deeper reason sampling or transfer prompt.

Sensitivity guardrails:

- initial error is not failure;
- no majority distribution before peer reasoning;
- no trick question with one obviously foolish choice;
- uncertainty remains valid when evidence is genuinely incomplete;
- do not turn atrocities or victimization into entertainment.

### Source duel

Purpose: practise sourcing, contextualization, usefulness, perspective, or corroboration.

| Time | Projected state | Teacher action | Student action |
| --- | --- | --- | --- |
| 0:00–0:25 | Central question and two short attributed excerpts | Name comparison question | Read for first impression |
| 0:25–0:50 | First commitment | Ask which source is more useful for this question, or `beide/onzeker` | Commit privately |
| 0:50–1:40 | Provenance reveal | Reveal author, date, audience, or purpose | Identify changed interpretation |
| 1:40–2:40 | Pair comparison | Prompt `Bron A toont…; bron B toont…` | Compare strength and limitation |
| 2:40–3:30 | Context/corroboration reveal | Add one relevant fact or third corroborating detail | Reassess usefulness |
| 3:30–4:10 | Revision | Request new judgment | Keep or revise |
| 4:10–5:30 | Evidence sampling | Ask for contrasting source-based reasons | Explain with provenance/content |
| 5:30–6:45 | Resolution | Model bounded historical claim | Distinguish usefulness from truth |
| 6:45–7:30 | Transfer | Ask one sourcing question for next lesson source | Retrieve reasoning move |

Five-minute exit omits corroboration extension. Twelve-minute extension adds a third source/detail and a short written claim.

Sensitivity guardrails:

- never reduce comparison to `welke bron liegt?`;
- adapted excerpts retain provenance and adaptation note;
- offensive historical language needs context and teacher warning;
- conflicting perspectives do not make every interpretation equally supported.

### Context-bound decision

Purpose: reason from constraints faced by historical actors without pretending students can fully inhabit their experience.

| Time | Projected state | Teacher action | Student action |
| --- | --- | --- | --- |
| 0:00–0:25 | Situation, role boundary, and decision | State what is known at that moment | Read constraints |
| 0:25–0:50 | Commitment choices, including uncertainty | Ask for private decision | Choose based on initial context |
| 0:50–1:40 | Constraint 1 | Reveal operational, social, economic, or technical evidence | Identify consequence |
| 1:40–2:40 | Adviser pair talk | Ask partners to challenge each other's plan | Defend and question choice |
| 2:40–3:30 | Constraint 2 | Reveal complication | Reassess trade-off |
| 3:30–4:10 | Revision | Request final recommendation | Keep or change |
| 4:10–5:30 | Reason sampling | Ask which constraint mattered most | Explain trade-off |
| 5:30–6:45 | Historical outcome | Reveal actual choice/outcome without hindsight ridicule | Compare decision and result |
| 6:45–7:30 | Lesson bridge | Connect systems, causation, and limits | State one causal link |

Five-minute exit uses one constraint. Twelve-minute extension adds stakeholder/source contrast and counterfactual limits.

Sensitivity guardrails:

- use adviser/system decisions rather than forced perpetrator or victim role-play;
- state what actors could and could not know;
- avoid hindsight ridicule and false moral equivalence;
- teacher can skip a prompt without breaking closure;
- human cost is resolved soberly, never as score or spectacle.

## Common classroom controls

Single mirrored projector shows a quiet control rail. Teacher actions remain visible but answers do not appear before reveal.

Required controls:

- `Start`;
- `Volgende` or `Toon meer`;
- `Terug`;
- `Overslaan` for optional evidence/discussion;
- `Stoppen` with confirmation, which returns to the activity preparation screen;
- `Opnieuw` with confirmation;
- `Klaar` at the defined 5-, 8-, or 12-minute closure.

The quiet control rail also shows the current short teacher prompt. `Escape` requests the same confirmed stop in the public presentation; inside the admin preview, `Escape` closes the preview and returns focus to its opener. `ArrowRight` and Space advance the presentation and finish it from the lesson bridge, so a clicker does not appear to stop working at the final stage.

No autoplay or countdown. Suggested time is teacher guidance, not deadline. Reload returns to preparation with clear reset message; session recovery is deferred. Runtime stores no student identity or response history.

## Domain decisions

- Each event has zero or one optional `beat` in V1. Article-only events remain valid.
- Published Beat V1 remains valid. New admin-authored activities use Beat V2; unknown versions and fields fail.
- Beat V2 adds one constrained physical `responseMethod` and an optional bounded `vocationalConnection`; detailed instructions remain stage-specific.
- `beat.mechanic` is a discriminated union: `vote-revote`, `source-duel`, or `context-decision`.
- Domain stores fixed cognitive-phase content, not arbitrary slides or layout controls.
- Runtime derives projected states from mechanic and chosen 5/8/12-minute route.
- Evidence references an existing event source by exact `sourceUrl`. Duplicate source objects and array indexes are forbidden.
- Each evidence item has stable ID, concise content, source reference, suggested duration, and earliest duration route.
- Opening plus commitment must plan first commitment within 30 seconds.
- Ordinary projected states plan 30–90 seconds.
- Every route ends with resolution and lesson bridge.
- Strings and arrays are bounded. Source URLs remain HTTP(S) and must match event sources.
- Generated historical images cannot be evidence. V1 starts with attributed text, quotations, numbers, and locally reviewed source descriptions; image support requires separate provenance/offline asset design.
- Application and `toen-content` keep matching strict validation. Shared-package extraction is deferred until duplication causes more cost than it removes.

### Canonical beat contract

Application repository owns beat contract in `src/lib/content/event.ts`. Content repository mirrors same strict schema in `src/catalog.ts`; matching fixtures cover both until shared-package extraction becomes cheaper than duplication. Every event may omit `beat`, so existing article-only Markdown needs no migration. Existing version `1` activities remain valid; new admin output uses version `2`.

Beat versions are strict discriminated variants over common content:

```ts
type BeatBase = {
  mechanic: "vote-revote" | "source-duel" | "context-decision";
  question: string;
  choices: Array<{ id: string; label: string }>;
  stages: BeatStage[];
  routes: [
    { durationMinutes: 5; stageIds: string[] },
    { durationMinutes: 8; stageIds: string[] },
    { durationMinutes: 12; stageIds: string[] },
  ];
  sensitivityNotes?: string[];
};

type BeatV1 = BeatBase & {
  version: 1;
};

type BeatV2 = BeatBase & {
  version: 2;
  responseMethod: "hand-signals" | "response-cards" | "mini-whiteboards" | "room-position" | "pair-talk" | "individual-writing";
  vocationalConnection?: string;
};

type Beat = BeatV1 | BeatV2;
```

Version `2` requires `responseMethod`; `vocationalConnection` is optional and limited to 240 characters. Strict Version `1` rejects both Version `2` fields. `source-duel` also requires exactly two source cards with `id`, `label`, `excerpt`, and exact `sourceUrl`. Cards must reference two distinct event sources. `context-decision` also requires a `perspective`. `vote-revote` adds no mechanic-specific field.

Every stage has canonical kebab-case `id`, `suggestedSeconds`, `teacherPrompt`, and `expectedStudentAction`. Phase-specific fields are fixed:

- `opening`: `stimulus`;
- `commitment`: `prompt`;
- `evidence`: `title`, `evidence`, exact `sourceUrl`, `earliestDurationMinutes`, and optional `optional: true`;
- `discussion`: `prompt`, optional `sentenceStarter`, and optional `optional: true`;
- `revision`: `prompt`;
- `reasoning`: `prompt` and optional `optional: true`;
- `resolution`: `title`, `feedback`, optional `misconception`, and one to four exact `sourceUrls`;
- `lesson-bridge`: `bridge`.

Structural bounds:

- IDs: 1–64 characters;
- choices: 2–4; labels: at most 80 characters;
- stages: 7–16;
- teacher prompts: at most 240 characters;
- expected student actions: at most 160 characters;
- projected questions and prompts: at most 240 characters;
- source excerpts, stimuli, evidence, feedback, perspectives, and lesson bridges: at most 400 characters;
- sensitivity notes: at most five entries of 300 characters;
- opening and commitment: 1–30 suggested seconds;
- every other stage: 30–90 suggested seconds.

Semantic validation requires unique choice, stage, and source-card IDs; exact event-source ownership; exactly one opening, commitment, revision, resolution, and lesson bridge; route references that exist and preserve master stage order; no duplicate route stages; use of every declared stage; and evidence checkpoints matching first route use. Five-minute stages form an ordered subsequence of eight-minute stages, which form an ordered subsequence of twelve-minute stages. Every route starts with opening and commitment, contains evidence, discussion, and revision, and ends with resolution and lesson bridge.

Suggested times are guidance, not autoplay. Route totals may not exceed their named budget. Eight-minute route must exceed five minutes of planned content; twelve-minute route must exceed eight minutes. Exact totals are not required because teacher-led discussion owns pace.

Unknown versions, mechanics, fields, unsafe URLs, unsupported optional phases, and invalid bounds fail. Deterministic serialization includes `beat` after event sources and omits it for legacy documents.

## Runtime decisions

- Public classroom route: `/events/[slug]/play`.
- Event article route remains `/events/[slug]`.
- Server loads validated content; client receives only event identity, sources needed for attribution, and beat payload.
- Pure local reducer owns preparation, duration, current state, skipped states, reset, and finish.
- No live response backend and no rough-total entry in first V1 runtime. Teacher can use physical response methods.
- Default duration is 8 minutes; teacher may choose 5 or 12 before Start.
- First meaningful stimulus renders immediately after Start.
- Classroom screen uses one dominant task and never scrolls at target projector sizes.

## Homepage decisions

- Catalog exposes beat availability, mechanic, and durations without article body or full evidence payload.
- Runnable event card primary action: `Start`.
- Article/background action remains secondary.
- Default path requires at most two decisions: select beat, then Start.
- Full weekly-event discovery remains available but no longer dominates first viewport.

## Creator decisions

- Extend `EventAuthoringProvider`; do not restore deleted components.
- Migrate one versioned local draft instead of creating separate beat storage.
- Beat editing uses constrained mechanic fields; no slide designer.
- Exact classroom runtime renders inside review before publication.
- Manual ChatGPT flow: minimal topic/preferences → deterministic versioned prompt → Copy → consumer ChatGPT → paste structured response → strict browser validation → editable fields → server preview → source review → explicit publication confirmation.
- Imported text is untrusted. No `eval`, brace extraction, automatic URL trust, automatic publication, model API, or credential exposure.
- Import application invalidates prior preview/publication readiness.
- Valid model output can fill a new draft only in first V1. Merge/selective-import complexity is deferred.
- Teacher must explicitly confirm required sources were opened and reviewed before publication.

### Manual ChatGPT handoff contract

Prompt format version 1 is browser-only and uses no model API. Teacher provides only topic, optional lesson context, preferred duration, mechanic, physical response method, and profile. Prompt generation must not read the current authoring draft, identity, URL, canonical path, credentials, environment, preview, or publication state.

Each generated prompt receives a random UUID request ID. Builder output is deterministic for a fixed request ID and fixed allowlisted input. Teacher input is serialized as JSON between collision-free request-bound markers and explicitly treated as untrusted data, never instructions. Only active `{ formatVersion, requestId }` metadata is kept in session storage for later stale-response validation; prompt text is not stored and is never added to the ChatGPT URL.

A successful response is one JSON object inside one lower-case `json` Markdown code fence, with no surrounding prose. The fence makes the complete response easy to copy back from consumer ChatGPT. The object contains:

- `formatVersion: 1`, exact `requestId`, and `status: "complete"`;
- `draft` matching the canonical event input and strict Beat V2 contract rather than browser-shaped authoring fields;
- `claims` linking each substantive historical claim to exact URLs from `draft.sources`, with explicit uncertainty where needed.

When reliable source URLs cannot be checked, response uses `status: "cannot-complete"` and concrete Dutch reasons instead of inventing citations. No response is trusted because its request ID matches. Bounded parsing, duplicate-key rejection, strict validation, authoring-draft mapping, repair, and preview invalidation belong to the import milestone. Human source review remains required because URL syntax and reachability do not prove a claim.

Clipboard success keeps protocol text out of normal teacher flow. Clipboard rejection reveals same instructions in a focused read-only field for manual copying. UI discloses that pasted content goes to OpenAI, forbids student personal data and secrets, opens plain `https://chatgpt.com/` in a new tab, and never opens it automatically.

### ChatGPT response import contract

First release applies a valid response only to a completely empty authoring draft with no pending stored-draft recovery. It never merges fields, fills blanks, selects sections, or overwrites existing teacher work. Pasted text remains in component memory after validation errors and is never written to browser storage. Applying a valid import atomically invalidates any preview/publication state, consumes the active request, keeps the teacher on the story stage, and still requires canonical server preview plus explicit publication confirmation.

Prompt and repair instructions require exactly one outer lower-case `json` code fence. Importer also accepts one raw JSON object for compatibility with responses generated by earlier instructions. It uses no `eval`, JSON5, YAML, brace search, or prose extraction. Before one final `JSON.parse`, a JSON grammar preflight enforces 65,536 UTF-8 bytes, depth 32, 2,048 values, 1,024 object members, 128 members per object, 64 items per array, 128-character keys, 20,000-character strings, 49,152 decoded string bytes, and 32-character numbers. Preflight rejects duplicate decoded keys, unsafe markup, malformed Unicode, and prototype/credential/path keys.

Strict envelopes accept only `complete` or `cannot-complete`, format version 1, and exact active request UUID. Complete responses require canonical event input, Beat V2, supported Markdown, bounded taxonomy/source/claim data, exact claim-to-source URL relationships, and a lossless canonical → authoring → canonical round trip. Non-representable route structures fail rather than changing activity semantics. A valid `cannot-complete` response is shown as a safe terminal explanation, not mislabeled as malformed. Deterministic repair instructions describe bounded Dutch issues without echoing hostile pasted text; clipboard denial receives the same focused manual-copy fallback.

Historical truth remains outside parser guarantees.

### Imported AI review and source confirmation

Source review applies only to drafts created by a successful ChatGPT import. Manual drafts retain the existing review flow. Imported claims and their original URL relationships are mapped to stable local source identities and stored beside—not inside—the canonical `AuthoringDraft`. Local storage version 3 keeps draft, step, AI provenance, current claim relationships, URL-bound source attestations, and claim decisions together. Version 2 and version 1 drafts migrate as manual drafts under this delivery's atomic-rollout assumption: response import was not deployed before the version 3 review gate. That migration must become conservative if release ordering changes. Restored review-stage drafts still return to editing because canonical server previews are never persisted.

Review uses the same safe `EventArticle` and exact `BeatPlayer` as publication/runtime preview. An admin-only layer renders claim text, original and current source relationships, uncertainty, sensitivity notes, and unverified-source status through React text nodes and controlled links. It states that technical shape, URL syntax, link activation, and even a working page do not prove historical support. Link activation records only that the teacher chose the current link; a separate confirmation attests that the teacher opened and checked the page.

Every current source must be chosen and confirmed against its exact current URL. Every active claim must retain at least one current source relationship and be explicitly confirmed after its linked sources, or be explicitly marked as no longer present in the current text. Teachers can correct canonical story, source, and beat fields through the existing stages and can correct current claim/source relationships in review without returning to ChatGPT. Original ChatGPT URLs remain visible as provenance.

Any canonical edit invalidates the server preview, marks the imported proposal as changed, and resets claim decisions. Source URL edits additionally clear that source's link choice and confirmation, including an A → B → A edit. Added sources start unchecked; removed sources lose their current claim relationships; reordering preserves source identity. Review changes persist locally but never enter `toEventDraftInput`, preview payloads, event Markdown, or published content.

Publication controls, confirmation opening, and the publish action all fail closed while imported-AI review is incomplete. Manual drafts bypass only this AI-specific gate and still require canonical server preview plus explicit publication confirmation. This remains an editorial UX attestation, not proof of source reachability, understanding, or historical truth; local storage and direct API access are not compliance-grade evidence.

## Serial delivery plan

### Milestone 1 — domain parity

TDD optional beat schema, deterministic serialization, semantic timing/order/source checks, legacy compatibility, and matching app/content fixtures.

### Milestone 2 — first runtime slice

TDD pure reducer and Apollo vote/revote route. Add the canonical sourced Apollo beat in `toen-content` so local OpenNext Worker journeys exercise real synchronized content. Add keyboard, pointer, touch, reduced-motion, reset/back/skip/finish, and projector geometry coverage.

### Milestone 3 — complete the four-activity starter set

Add sourced Belgian independence, D-Day, and Constantinople activities in `toen-content`; revise the Apollo 11 slice from milestone 2, then validate and sync the exact revision. Keep article-only events valid through schema and route-level fixture coverage.

### Milestone 4 — homepage

Prioritize runnable beats while preserving filters, recommendations, and article access.

### Milestone 5 — constrained admin editing

Migrate draft format, add beat fields and exact runtime preview, preserve stale-preview, storage, conflict, dry-run, and partial-deploy protections.

### Milestone 6 — manual ChatGPT workflow

TDD prompt generation, clipboard fallback, bounded strict paste parsing, repair prompt, source warnings, editable import, and review confirmation.

### Milestone 7 — hardening

Run app/content verification, Next/OpenNext builds, BDD, target viewports, keyboard/touch/reduced motion/zoom, malformed import, legacy article, localStorage failure, Access, conflict, dry-run, and partial deployment checks.

No commit, push, deploy, publication, or production configuration mutation without user approval.
