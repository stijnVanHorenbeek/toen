# Interactive history beats: V1 implementation

Status: approved direction on 2026-08-11

## Scope decision

Build full creator V1 in serial milestones:

1. versioned beat domain;
2. classroom runtime and three curated beats;
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
- `Volgende` or `Onthul`;
- `Terug`;
- `Overslaan` for optional evidence/discussion;
- `Opnieuw` with confirmation;
- `Afronden` at defined 5-, 8-, or 12-minute closure.

No autoplay or countdown. Suggested time is teacher guidance, not deadline. Reload returns to preparation with clear reset message. Runtime stores no student identity or response history.

## Domain decisions

- Each event has zero or one optional `beat` in V1. Article-only events remain valid.
- `beat.version` is `1`; unknown versions and fields fail.
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

### Canonical V1 beat contract

Application repository owns beat contract in `src/lib/content/event.ts`. Content repository mirrors same strict schema in `src/catalog.ts`; matching fixtures cover both until shared-package extraction becomes cheaper than duplication. Every event may omit `beat`, so existing article-only Markdown needs no migration. Any present beat must use version `1`.

Common beat fields:

```ts
type BeatV1 = {
  version: 1;
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
```

`source-duel` also requires exactly two source cards with `id`, `label`, `excerpt`, and exact `sourceUrl`. Cards must reference two distinct event sources. `context-decision` also requires a `perspective`. `vote-revote` adds no mechanic-specific field.

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
- Runnable event card primary action: `Start klasbeat`.
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

## Serial delivery plan

### Milestone 1 — domain parity

TDD optional beat schema, deterministic serialization, semantic timing/order/source checks, legacy compatibility, and matching app/content fixtures.

### Milestone 2 — first runtime slice

TDD pure reducer and Apollo vote/revote route. Add keyboard, pointer, touch, reduced-motion, reset/back/skip/finish, and projector geometry coverage.

### Milestone 3 — three curated beats

Add sourced Apollo 11, Belgian independence, and D-Day beats in `toen-content`; validate/sync exact revision. Constantinople remains article-only fallback.

### Milestone 4 — homepage

Prioritize runnable beats while preserving filters, recommendations, and article access.

### Milestone 5 — constrained admin editing

Migrate draft format, add beat fields and exact runtime preview, preserve stale-preview, storage, conflict, dry-run, and partial-deploy protections.

### Milestone 6 — manual ChatGPT workflow

TDD prompt generation, clipboard fallback, bounded strict paste parsing, repair prompt, source warnings, editable import, and review confirmation.

### Milestone 7 — hardening

Run app/content verification, Next/OpenNext builds, BDD, target viewports, keyboard/touch/reduced motion/zoom, malformed import, legacy article, localStorage failure, Access, conflict, dry-run, and partial deployment checks.

No commit, push, deploy, publication, or production configuration mutation without user approval.
