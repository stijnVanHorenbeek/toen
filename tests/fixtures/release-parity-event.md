---
title: Release parity event
date:
  year: 1969
  era: ce
  precision: day
  month: 7
  day: 20
summary: Fixture voor schema-pariteit tussen toepassing en inhoudsrepository.
topics:
  - wetenschap
  - cafe-cultuur
topicLabels:
  cafe-cultuur: Café-cultuur
profiles:
  - algemeen
  - elektriciteit
sources:
  - title: Mission report
    publisher: Test archive
    url: https://example.org/mission-report
  - title: Crew transcript
    publisher: Test archive
    url: https://example.org/crew-transcript
beat:
  question: Moet het team doorgaan of stoppen?
  choices:
    - id: continue
      label: Doorgaan
    - id: stop
      label: Stoppen
    - id: uncertain
      label: Onzeker
  stages:
    - id: opening
      teacherPrompt: Toon alleen het probleem. Geef nog geen extra uitleg.
      expectedStudentAction: Lees het probleem en denk privé na.
      phase: opening
      suggestedSeconds: 20
      stimulus: De geplande route blijkt niet veilig. Wat doe je?
    - id: commitment
      teacherPrompt: Vraag iedereen om discreet een keuze te tonen.
      expectedStudentAction: Kies vóór het gesprek één antwoord.
      phase: commitment
      suggestedSeconds: 20
      prompt: Kies eerst voor jezelf. Je mag ook onzeker zijn.
    - id: route-evidence
      teacherPrompt: Vraag welk detail de eerste keuze beïnvloedt.
      expectedStudentAction: Zoek één detail dat je keuze steunt of verzwakt.
      phase: evidence
      suggestedSeconds: 50
      title: De route
      evidence: Het missierapport beschrijft een probleem met de geplande route.
      sourceUrl: https://example.org/mission-report
      earliestDurationMinutes: 5
    - id: first-discussion
      teacherPrompt: Laat beide partners één reden geven.
      expectedStudentAction: Vergelijk redenen zonder klassentotalen te bespreken.
      phase: discussion
      suggestedSeconds: 60
      prompt: Welk bewijs weegt voor jou het zwaarst?
      sentenceStarter: Ik denk dit omdat…
    - id: communication-evidence
      teacherPrompt: Vraag wat het team op dat moment kon weten.
      expectedStudentAction: Herbekijk je keuze met de nieuwe informatie.
      phase: evidence
      suggestedSeconds: 60
      title: De communicatie
      evidence: Het transcript toont welke informatie het team toen had.
      sourceUrl: https://example.org/crew-transcript
      earliestDurationMinutes: 8
      optional: true
    - id: second-discussion
      teacherPrompt: Laat partners een zwakke plek in elkaars reden zoeken.
      expectedStudentAction: Toets je reden aan die van je partner.
      phase: discussion
      suggestedSeconds: 60
      prompt: Wat maakt de andere keuze nog verdedigbaar?
      optional: true
    - id: outcome-clue
      teacherPrompt: Gebruik dit alleen voor extra verdieping.
      expectedStudentAction: Benoem welke afweging ingewikkelder wordt.
      phase: evidence
      suggestedSeconds: 70
      title: Een extra aanwijzing
      evidence: Een later detail maakt de afweging ingewikkelder.
      sourceUrl: https://example.org/mission-report
      earliestDurationMinutes: 12
      optional: true
    - id: third-discussion
      teacherPrompt: Vraag naar grenzen van een tegenfeitelijke keuze.
      expectedStudentAction: Leg uit welke onzekerheid overblijft.
      phase: discussion
      suggestedSeconds: 60
      prompt: Welke informatie ontbreekt nog voor een zekere keuze?
      optional: true
    - id: revision
      teacherPrompt: Vraag opnieuw om een private keuze.
      expectedStudentAction: Behoud of wijzig je eerste antwoord.
      phase: revision
      suggestedSeconds: 30
      prompt: Kies opnieuw. Veranderen na bewijs is sterk redeneren.
    - id: reasoning
      teacherPrompt: Vraag één gewijzigde en één behouden keuze.
      expectedStudentAction: Verbind je antwoord aan concreet bewijs.
      phase: reasoning
      suggestedSeconds: 40
      prompt: Welk bewijs bepaalde je tweede keuze?
      optional: true
    - id: resolution
      teacherPrompt: Verbind beslissing, bewijs en historische uitkomst.
      expectedStudentAction: Controleer je redenering zonder je eerste keuze als fout te zien.
      phase: resolution
      suggestedSeconds: 60
      title: Wat gebeurde er?
      feedback: Het team paste de route aan op basis van beschikbare informatie en samenwerking.
      misconception: Een moeilijke keuze heeft niet altijd één risicoloos antwoord.
      sourceUrls:
        - https://example.org/mission-report
        - https://example.org/crew-transcript
    - id: lesson-bridge
      teacherPrompt: Keer terug naar informatie en samenwerking in de les.
      expectedStudentAction: Formuleer één verband met het lesthema.
      phase: lesson-bridge
      suggestedSeconds: 30
      bridge: Welke rol speelden informatie en samenwerking in deze gebeurtenis?
  routes:
    - durationMinutes: 5
      stageIds:
        - opening
        - commitment
        - route-evidence
        - first-discussion
        - revision
        - resolution
        - lesson-bridge
    - durationMinutes: 8
      stageIds:
        - opening
        - commitment
        - route-evidence
        - first-discussion
        - communication-evidence
        - second-discussion
        - revision
        - reasoning
        - resolution
        - lesson-bridge
    - durationMinutes: 12
      stageIds:
        - opening
        - commitment
        - route-evidence
        - first-discussion
        - communication-evidence
        - second-discussion
        - outcome-clue
        - third-discussion
        - revision
        - reasoning
        - resolution
        - lesson-bridge
  sensitivityNotes:
    - Vermijd oordelen met kennis die betrokkenen toen niet hadden.
  version: 2
  responseMethod: response-cards
  vocationalConnection: Vergelijk historische risico's met een veiligheidsprocedure.
  mechanic: vote-revote
---

## Test

Een canonieke tekst met **nadruk** en een [bron](https://example.org/source).
