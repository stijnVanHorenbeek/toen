# Interactive history beats: v1 product contract

Status: provisional product contract

This document uses published research and explicit product judgments to unblock v1 work during summer vacation. Classroom validation remains required before broader rollout.

## Product objective

Toen. should help a history teacher run one source-backed, interactive classroom moment inside an existing lesson.

The v1 unit is an **interactive history beat**:

- lasts 5, 8, or 12 minutes;
- starts with a meaningful historical problem or stimulus;
- asks every student to commit to a position or observation;
- reveals evidence progressively;
- creates structured peer reasoning;
- lets students revise their answer;
- ends with teacher feedback, historical payoff, and clean return to the lesson.

Toen. does not generate or replace a complete lesson in v1.

## Current product baseline

The current application is a Next.js 16 and React 19 application deployed through OpenNext on Cloudflare Workers.

Public flow:

1. Homepage filters and ranks historical events by week, period, topic, and `Vakrichting`.
2. Teacher or student opens a recommended event.
3. Event page renders a sourced long-form article.

Authoring flow:

1. Trusted editor opens `/admin` behind Cloudflare Access.
2. Editor writes an event, adds classification and sources, reviews the real rendering, and confirms publication.
3. Worker validates content, commits deterministic Markdown to the dedicated `toen-content` repository, and triggers deployment.

Useful foundations already exist:

- strict Zod event validation;
- deterministic Markdown parsing and serialization;
- separate canonical content repository;
- typed Belgian Dutch copy;
- staged teacher authoring with local draft recovery;
- public/admin preview parity through `EventArticle`;
- Cloudflare Access, GitHub App, and deploy-hook trust boundary;
- unit, TypeScript, Biome, Next, OpenNext, and Playwright-BDD verification.

Missing foundation: event schema and public routes have no beat, scene, choice, reveal, teacher control, classroom mode, response state, or completion model.

## Evidence boundary

Research can support general interaction principles before a classroom pilot. It cannot prove that one implementation will work for every class.

Social platforms demonstrate that product design can capture and retain attention. They do not establish that the same mechanics improve historical reasoning, participation, or retention. Toen. can borrow curiosity, rapid feedback, visible consequence, and frequent meaningful state changes. It must not optimize screen time or reproduce manipulative retention patterns.

Three labels distinguish evidence strength:

- **Research-backed:** supported by relevant history, classroom-response, motivation, or learning research.
- **Product judgment:** chosen boundary or design rule that makes v1 coherent and testable.
- **Pilot hypothesis:** plausible classroom effect that must be observed after classes resume.

## Provisional classroom assumptions

| ID | Label | Assumption | Product consequence | Later validation |
| --- | --- | --- | --- | --- |
| A1 | Product judgment | Target students are approximately 15–18 years old and can read normal age-level Dutch. | Do not treat vocational education as a reading-level diagnosis. Keep projected text concise because projection and attention require it. | Confirm with teacher after summer. |
| A2 | Research-backed | Passive listening and fastest-volunteer questioning leave many students uncommitted. Structured response and discussion can broaden participation. | Ask everyone to think or commit before public discussion. | Observe participation breadth during pilot. |
| A3 | Product judgment | Attention, not reading level, is primary design constraint. | Change meaningful classroom state every 30–90 seconds. Avoid long projected exposition. | Record attention drops and teacher interventions. |
| A4 | Research-backed | Curiosity, active response, feedback, and revision can support attention and learning when tied to specific content. | Use problem → commitment → evidence → peer reasoning → revision → teacher feedback as default rhythm. | Compare first answer, revised answer, and discussion quality. |
| A5 | Product judgment | Default delivery uses one teacher laptop and shared projector. Exact hardware is unknown. | Do not require extended display mode or student devices. | Record actual laptop, projector, remote, browser, and resolution. |
| A6 | Product judgment | Default activities must work without student accounts, phones, apps, or reliable Wi-Fi. | Use fingers, cards, room position, mini-whiteboards, pair talk, or teacher-entered rough totals. | Confirm phone policy and preferred classroom routines. |
| A7 | Research-backed | Public speed ranking can add stress, reward guessing, and narrow participation. | No speed scoring, individual leaderboard, streak, or public low-performer state. | Ask whether any optional team competition adds value without exclusion. |
| A8 | Product judgment | Teacher must remain pace owner. | No automatic progression. Provide reveal, back, skip, reset, and finish controls. | Observe whether controls match real teaching rhythm. |
| A9 | Research-backed | Vocational relevance is useful when it reflects authentic work systems and historical causation. Forced occupation references can become superficial. | Connect topics to labour, tools, safety, transport, materials, regulation, care, migration, or supply chains only when historically relevant. | Compare authentic and generic hooks during pilot. |
| A10 | Product judgment | Three strong mechanics are enough for first release. | Avoid generic activity-builder complexity. | Keep, change, or drop each mechanic after pilot. |
| A11 | Pilot hypothesis | Private or pair commitment will involve more students than open volunteering. | Make private think or commit phase default. | Compare visible commitment with later public responses. |
| A12 | Pilot hypothesis | Evidence reveal and revote will recover attention better than immediate answer reveal. | First vertical slice should support vote → evidence → revote. | Observe attention, answer changes, and evidence-linked explanations. |
| A13 | Pilot hypothesis | Meaningful state changes every 30–90 seconds will feel energetic without becoming frantic. | Give every stage a suggested duration and visible teacher-controlled transition. | Record stages that feel slow, rushed, or unnecessary. |

## Product principles

1. **Start with uncertainty.** Show an unexplained image, decision, claim, quantity, or source fragment before explanation.
2. **Require commitment.** Ask all students to choose, estimate, observe, rank, or state uncertainty before answer reveal.
3. **Reveal evidence progressively.** Each reveal must change or complicate available reasoning.
4. **Reward revision.** Changing an answer after evidence is successful reasoning, not failure.
5. **Resolve with teaching.** Teacher feedback connects answer, evidence, and historical concept.
6. **Keep history central.** Interaction serves sourcing, context, causation, change, perspective, or evidence. It is not decorative polling.
7. **Keep teacher in control.** Teacher decides when discussion has enough energy or needs to move on.
8. **Keep projection focused.** One dominant question, decision, visual, or evidence item per state.
9. **Keep participation low-friction.** Default flow needs no student setup.
10. **Keep claims attributable.** Historical claims and images retain source identity and provenance.
11. **End cleanly.** Every duration route has a defined closing point and lesson bridge.

## Attention budget

Each beat must satisfy these content and interaction limits:

- meaningful stimulus appears within 5 seconds after launch;
- first student commitment is requested within 30 seconds;
- planned state duration is 30–90 seconds unless teacher-led discussion intentionally continues;
- one projected state contains no more than one dominant task;
- no projected prose wall substitutes for teacher explanation;
- teacher can finish at a defined 5-, 8-, or 12-minute checkpoint;
- motion communicates reveal, comparison, or navigation only;
- reduced-motion mode preserves all meaning.

These limits control planned pacing. They do not force teacher timing or automatic advancement.

## Initial mechanic candidates

### Vote → evidence → revote

Students choose between defensible positions, inspect new evidence, discuss, then may change position. Product can show rough class totals without identifying students.

### Source duel

Students compare two short sources for usefulness, perspective, or reliability. Teacher reveals source metadata and prompts in stages.

### Context-bound decision

Students advise within constraints known to historical actors, inspect new operational, social, economic, or technical evidence, then revise their recommendation. Teacher resolves actual choice and outcome without hindsight ridicule or forced victim/perpetrator role-play.

Myth repair and cause budget remain later candidates.

## Architecture boundaries

### Application repository

`toen` owns:

- beat domain types and validation used by runtime and authoring;
- teacher preparation and classroom routes;
- local beat progression state;
- admin prompt/import/review experience;
- preview, publication, and deployment integration;
- public and classroom rendering tests.

Do not restore deleted pre-redesign admin components. Extend current provider, locale, preview, and publication architecture.

### Content repository

`toen-content` remains canonical source for published Markdown. Beat fields require matching validation in both repositories until validation is shared or generated from one contract.

Do not edit generated `toen/content/events` files directly. `pnpm content:sync` replaces them from an immutable content revision.

### AI boundary

Manual ChatGPT support fits before existing server preview:

1. Teacher enters minimal topic and preferences.
2. Browser builds deterministic, versioned prompt.
3. Teacher copies prompt into consumer ChatGPT.
4. Teacher pastes structured response into admin flow.
5. Browser treats response as untrusted and validates it.
6. Existing server preview revalidates canonical content.
7. Teacher reviews sources and exact classroom rendering.
8. Existing explicit publication confirmation remains required.

No LLM API key, automatic model call, automatic publication, or model access to GitHub credentials.

## Anti-patterns

Do not add these to v1:

- infinite feed or autoplay;
- variable rewards designed to extend screen time;
- speed bonuses or countdown pressure by default;
- individual public rankings;
- points without a reasoning function;
- mandatory student accounts or phones;
- unmoderated public text responses;
- decorative animation, sound, badges, streaks, or confetti;
- generated historical images presented as evidence;
- long AI-written explanations on projector screens;
- full lesson or learning-management workflows;
- visual theme controls before instructional controls;
- duplicate local library that bypasses canonical publishing without a separate product decision.

## Product success metrics before classroom access

These targets are verifiable through design review, automated tests, or timed usability checks without students.

| Metric | Target | Verification |
| --- | --- | --- |
| Beat launch path | At most two teacher decisions from a recommended event | Playwright-BDD route and focus scenario |
| Beat launch time | Under 30 seconds from loaded homepage during moderated usability check | Timed teacher task |
| Custom creation input | Topic plus remembered defaults before prompt generation | Form inventory and usability check |
| First meaningful stimulus | Visible within 5 seconds after teacher activates Start | Performance mark and Playwright assertion |
| First commitment request | Planned within first 30 seconds | Beat-domain semantic validation |
| Planned passive state | No ordinary stage over 90 seconds | Beat-domain semantic validation |
| Projector focus | One dominant task per state | Content validation plus visual review |
| Teacher control | Reveal or advance, back, skip, reset, and finish available | Unit and Playwright-BDD tests |
| Duration routes | Defined 5-, 8-, and 12-minute closing checkpoints | Domain and fixture tests |
| No-device default | Complete beat works without student device or account | End-to-end classroom scenario |
| No technical jargon | Normal teacher journey contains no implementation terminology | Belgian Dutch copy test and usability review |
| Projector support | Fits 1920×1080, 1280×720, and 1024×576 without classroom-state scrolling | Playwright geometry tests |
| Accessible operation | Keyboard, pointer, touch, visible focus, and reduced motion preserve function | Playwright and manual accessibility review |

Implementation terminology includes GitHub, JSON, schema, issue, label, pull request, PR, repository path, and event ID. Technical details may remain inside existing collapsed maintainer disclosure.

## Deferred classroom questions

These questions do not block prototyping:

- Which laptop, browser, projector resolution, and remote does teacher use?
- Does classroom mirror or extend display?
- What phone policy and Wi-Fi reliability apply?
- Which physical response routines already work?
- How much movement and noise is acceptable?
- Which topics need special sensitivity guidance?
- Does teacher prefer exact spoken prompts or short private notes?
- Which duration preset fits normal lesson rhythm?
- Does weekly anniversary discovery help actual planning?

## Implementation baseline

[Implementation baseline before interactive beats](implementation-baseline.md) records reconciled application and content refs, passing verification, production configuration evidence, remaining unknowns, and branch strategy.

Application and content branch tips have divergent commit IDs but identical committed trees. Use each repository's `origin/main` tip as canonical base. Do not merge or cherry-pick equivalent feature branches.

Content-publishing infrastructure migration remains incomplete. Access route coverage, Secrets Store bindings, hook/build metadata, and configured GitHub App scope have evidence; secret values, live publishing mode, production attribution, rollback execution, and production failure recovery remain unverified.

These unknowns do not block paper or isolated clickable mechanic prototypes. They block claims that production publication migration is complete.

## Sources

- [Reading Like a Historian curriculum intervention](https://stacks.stanford.edu/file/druid:by786ht6640/a%20reisman_ReadingLikeaHistorian_CognitionandInstruction.pdf)
- [Systematic review of historical-literacy interventions](https://journals.uclpress.co.uk/herj/article/pubid/Hist_Educ_Res_J-20-9/)
- [Prequestion meta-analysis](https://pubmed.ncbi.nlm.nih.gov/37640836/)
- [EEF/UCL feedback systematic review](https://discovery.ucl.ac.uk/id/eprint/10138571/1/Systematic-Review-of-Feedback-EPPI-2021.pdf)
- [Systematic review of classroom student-response systems](https://link.springer.com/article/10.1186/s40561-024-00348-z)
- [Gamification and intrinsic motivation meta-analysis](https://link.springer.com/article/10.1007/s11423-023-10337-7)
- [OECD brief on screen time and distraction](https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/05/managing-screen-time_023f2390/7c225af4-en.pdf)

## Decision

This contract unblocks full creator V1 implementation before classroom observation. [V1 implementation](interactive-beats-implementation.md) records selected mechanics and serial delivery. Classroom pilot remains release gate for claims about attention, participation, or learning effectiveness.
