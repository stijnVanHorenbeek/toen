export const beatSources = [
	{
		title: "Mission report",
		publisher: "Test archive",
		url: "https://example.org/mission-report",
	},
	{
		title: "Crew transcript",
		publisher: "Test archive",
		url: "https://example.org/crew-transcript",
	},
] as const;

export const voteRevoteBeat = {
	version: 1,
	mechanic: "vote-revote",
	question: "Moet het team doorgaan of stoppen?",
	choices: [
		{ id: "continue", label: "Doorgaan" },
		{ id: "stop", label: "Stoppen" },
		{ id: "uncertain", label: "Onzeker" },
	],
	stages: [
		{
			id: "opening",
			phase: "opening",
			suggestedSeconds: 20,
			teacherPrompt: "Toon alleen het probleem. Geef nog geen extra uitleg.",
			expectedStudentAction: "Lees het probleem en denk privé na.",
			stimulus: "De geplande route blijkt niet veilig. Wat doe je?",
		},
		{
			id: "commitment",
			phase: "commitment",
			suggestedSeconds: 20,
			teacherPrompt: "Vraag iedereen om discreet een keuze te tonen.",
			expectedStudentAction: "Kies vóór het gesprek één antwoord.",
			prompt: "Kies eerst voor jezelf. Je mag ook onzeker zijn.",
		},
		{
			id: "route-evidence",
			phase: "evidence",
			suggestedSeconds: 50,
			teacherPrompt: "Vraag welk detail de eerste keuze beïnvloedt.",
			expectedStudentAction: "Zoek één detail dat je keuze steunt of verzwakt.",
			title: "De route",
			evidence:
				"Het missierapport beschrijft een probleem met de geplande route.",
			sourceUrl: beatSources[0].url,
			earliestDurationMinutes: 5,
		},
		{
			id: "first-discussion",
			phase: "discussion",
			suggestedSeconds: 60,
			teacherPrompt: "Laat beide partners één reden geven.",
			expectedStudentAction:
				"Vergelijk redenen zonder klassentotalen te bespreken.",
			prompt: "Welk bewijs weegt voor jou het zwaarst?",
			sentenceStarter: "Ik denk dit omdat…",
		},
		{
			id: "communication-evidence",
			phase: "evidence",
			suggestedSeconds: 60,
			teacherPrompt: "Vraag wat het team op dat moment kon weten.",
			expectedStudentAction: "Herbekijk je keuze met de nieuwe informatie.",
			title: "De communicatie",
			evidence: "Het transcript toont welke informatie het team toen had.",
			sourceUrl: beatSources[1].url,
			earliestDurationMinutes: 8,
			optional: true,
		},
		{
			id: "second-discussion",
			phase: "discussion",
			suggestedSeconds: 60,
			teacherPrompt: "Laat partners een zwakke plek in elkaars reden zoeken.",
			expectedStudentAction: "Toets je reden aan die van je partner.",
			prompt: "Wat maakt de andere keuze nog verdedigbaar?",
			optional: true,
		},
		{
			id: "outcome-clue",
			phase: "evidence",
			suggestedSeconds: 70,
			teacherPrompt: "Gebruik dit alleen voor extra verdieping.",
			expectedStudentAction: "Benoem welke afweging ingewikkelder wordt.",
			title: "Een extra aanwijzing",
			evidence: "Een later detail maakt de afweging ingewikkelder.",
			sourceUrl: beatSources[0].url,
			earliestDurationMinutes: 12,
			optional: true,
		},
		{
			id: "third-discussion",
			phase: "discussion",
			suggestedSeconds: 60,
			teacherPrompt: "Vraag naar grenzen van een tegenfeitelijke keuze.",
			expectedStudentAction: "Leg uit welke onzekerheid overblijft.",
			prompt: "Welke informatie ontbreekt nog voor een zekere keuze?",
			optional: true,
		},
		{
			id: "revision",
			phase: "revision",
			suggestedSeconds: 30,
			teacherPrompt: "Vraag opnieuw om een private keuze.",
			expectedStudentAction: "Behoud of wijzig je eerste antwoord.",
			prompt: "Kies opnieuw. Veranderen na bewijs is sterk redeneren.",
		},
		{
			id: "reasoning",
			phase: "reasoning",
			suggestedSeconds: 40,
			teacherPrompt: "Vraag één gewijzigde en één behouden keuze.",
			expectedStudentAction: "Verbind je antwoord aan concreet bewijs.",
			prompt: "Welk bewijs bepaalde je tweede keuze?",
			optional: true,
		},
		{
			id: "resolution",
			phase: "resolution",
			suggestedSeconds: 60,
			teacherPrompt: "Verbind beslissing, bewijs en historische uitkomst.",
			expectedStudentAction:
				"Controleer je redenering zonder je eerste keuze als fout te zien.",
			title: "Wat gebeurde er?",
			feedback:
				"Het team paste de route aan op basis van beschikbare informatie en samenwerking.",
			misconception:
				"Een moeilijke keuze heeft niet altijd één risicoloos antwoord.",
			sourceUrls: [beatSources[0].url, beatSources[1].url],
		},
		{
			id: "lesson-bridge",
			phase: "lesson-bridge",
			suggestedSeconds: 30,
			teacherPrompt: "Keer terug naar informatie en samenwerking in de les.",
			expectedStudentAction: "Formuleer één verband met het lesthema.",
			bridge:
				"Welke rol speelden informatie en samenwerking in deze gebeurtenis?",
		},
	],
	routes: [
		{
			durationMinutes: 5,
			stageIds: [
				"opening",
				"commitment",
				"route-evidence",
				"first-discussion",
				"revision",
				"resolution",
				"lesson-bridge",
			],
		},
		{
			durationMinutes: 8,
			stageIds: [
				"opening",
				"commitment",
				"route-evidence",
				"first-discussion",
				"communication-evidence",
				"second-discussion",
				"revision",
				"reasoning",
				"resolution",
				"lesson-bridge",
			],
		},
		{
			durationMinutes: 12,
			stageIds: [
				"opening",
				"commitment",
				"route-evidence",
				"first-discussion",
				"communication-evidence",
				"second-discussion",
				"outcome-clue",
				"third-discussion",
				"revision",
				"reasoning",
				"resolution",
				"lesson-bridge",
			],
		},
	],
	sensitivityNotes: [
		"Vermijd oordelen met kennis die betrokkenen toen niet hadden.",
	],
} as const;

export const sourceDuelBeat = {
	...voteRevoteBeat,
	mechanic: "source-duel",
	question: "Welke bron helpt het meest om de beslissing te begrijpen?",
	sourceCards: [
		{
			id: "mission-report",
			label: "Bron A",
			excerpt: "Een kort fragment uit het missierapport.",
			sourceUrl: beatSources[0].url,
		},
		{
			id: "crew-transcript",
			label: "Bron B",
			excerpt: "Een kort fragment uit het gesprek van de bemanning.",
			sourceUrl: beatSources[1].url,
		},
	],
} as const;

export const contextDecisionBeat = {
	...voteRevoteBeat,
	mechanic: "context-decision",
	perspective:
		"Je adviseert het team met alleen de informatie die op dat moment beschikbaar was.",
	question: "Welk advies geef je?",
	choices: [
		{ id: "plan-a", label: "Plan A" },
		{ id: "plan-b", label: "Plan B" },
		{ id: "uncertain", label: "Meer informatie nodig" },
	],
} as const;

function replaceStage(
	id: string,
	replacement: Record<string, unknown>,
): Record<string, unknown> {
	return {
		...voteRevoteBeat,
		stages: voteRevoteBeat.stages.map((stage) =>
			stage.id === id ? { ...stage, ...replacement } : stage,
		),
	};
}

export const invalidBeatIdentityCases = [
	[
		"duplicate choice IDs",
		{
			...voteRevoteBeat,
			choices: [
				voteRevoteBeat.choices[0],
				{ ...voteRevoteBeat.choices[1], id: voteRevoteBeat.choices[0].id },
				voteRevoteBeat.choices[2],
			],
		},
	],
	["duplicate stage IDs", replaceStage("commitment", { id: "opening" })],
	[
		"evidence outside event sources",
		replaceStage("route-evidence", {
			sourceUrl: "https://example.org/invented",
		}),
	],
	[
		"resolution outside event sources",
		replaceStage("resolution", {
			sourceUrls: ["https://example.org/invented"],
		}),
	],
	[
		"source card outside event sources",
		{
			...sourceDuelBeat,
			sourceCards: [
				{
					...sourceDuelBeat.sourceCards[0],
					sourceUrl: "https://example.org/invented",
				},
				sourceDuelBeat.sourceCards[1],
			],
		},
	],
	[
		"duplicate source-card IDs",
		{
			...sourceDuelBeat,
			sourceCards: [
				sourceDuelBeat.sourceCards[0],
				{
					...sourceDuelBeat.sourceCards[1],
					id: sourceDuelBeat.sourceCards[0].id,
				},
			],
		},
	],
	[
		"source duel using one source twice",
		{
			...sourceDuelBeat,
			sourceCards: [
				sourceDuelBeat.sourceCards[0],
				{
					...sourceDuelBeat.sourceCards[1],
					sourceUrl: sourceDuelBeat.sourceCards[0].sourceUrl,
				},
			],
		},
	],
] as const;

function replaceRoute(
	durationMinutes: 5 | 8 | 12,
	stageIds: readonly string[],
): Record<string, unknown> {
	return {
		...voteRevoteBeat,
		routes: voteRevoteBeat.routes.map((route) =>
			route.durationMinutes === durationMinutes
				? { ...route, stageIds }
				: route,
		),
	};
}

const fiveMinuteStageIds = voteRevoteBeat.routes[0].stageIds;
const eightMinuteStageIds = voteRevoteBeat.routes[1].stageIds;
const twelveMinuteStageIds = voteRevoteBeat.routes[2].stageIds;

export const invalidBeatRouteCases = [
	[
		"route referencing an unknown stage",
		replaceRoute(5, [
			...fiveMinuteStageIds.slice(0, 4),
			"missing-stage",
			...fiveMinuteStageIds.slice(4),
		]),
	],
	[
		"duplicate stage in a route",
		replaceRoute(5, [
			...fiveMinuteStageIds.slice(0, 4),
			"first-discussion",
			...fiveMinuteStageIds.slice(4),
		]),
	],
	[
		"route departing from master stage order",
		replaceRoute(5, ["commitment", "opening", ...fiveMinuteStageIds.slice(2)]),
	],
	[
		"discussion before the first evidence",
		{
			...voteRevoteBeat,
			stages: [
				...voteRevoteBeat.stages.slice(0, 2),
				voteRevoteBeat.stages[3],
				voteRevoteBeat.stages[2],
				...voteRevoteBeat.stages.slice(4),
			],
			routes: voteRevoteBeat.routes.map((route) => ({
				...route,
				stageIds: route.stageIds.map((id) =>
					id === "route-evidence"
						? "first-discussion"
						: id === "first-discussion"
							? "route-evidence"
							: id,
				),
			})),
		},
	],
	[
		"shorter route that is not contained in longer routes",
		replaceRoute(
			8,
			eightMinuteStageIds.filter((id) => id !== "first-discussion"),
		),
	],
	[
		"stage unused by every route",
		replaceRoute(
			12,
			twelveMinuteStageIds.filter((id) => id !== "third-discussion"),
		),
	],
	[
		"evidence with the wrong earliest route",
		replaceStage("communication-evidence", {
			earliestDurationMinutes: 12,
		}),
	],
	[
		"five-minute route exceeding its budget",
		replaceRoute(5, [
			...fiveMinuteStageIds.slice(0, 5),
			"reasoning",
			...fiveMinuteStageIds.slice(5),
		]),
	],
	[
		"long routes that do not exceed the previous checkpoint",
		{
			...voteRevoteBeat,
			stages: voteRevoteBeat.stages.map((stage) => ({
				...stage,
				suggestedSeconds:
					stage.phase === "opening" || stage.phase === "commitment" ? 1 : 30,
			})),
		},
	],
	[
		"duplicate fixed closure phase",
		{
			...voteRevoteBeat,
			stages: voteRevoteBeat.stages.flatMap<Record<string, unknown>>((stage) =>
				stage.id === "resolution"
					? [{ ...stage, id: "second-resolution" }, stage]
					: [stage],
			),
			routes: voteRevoteBeat.routes.map((route) =>
				route.durationMinutes === 12
					? {
							...route,
							stageIds: route.stageIds.flatMap((id) =>
								id === "resolution" ? ["second-resolution", id] : [id],
							),
						}
					: route,
			),
		},
	],
	[
		"route without a lesson bridge",
		replaceRoute(5, fiveMinuteStageIds.slice(0, -1)),
	],
	[
		"route without revision",
		replaceRoute(
			5,
			fiveMinuteStageIds.filter((id) => id !== "revision"),
		),
	],
] as const;

export const invalidBeatStructuralCases = [
	["unknown beat version", { ...voteRevoteBeat, version: 2 }],
	["unknown beat field", { ...voteRevoteBeat, autoplay: true }],
	["unknown stage field", replaceStage("opening", { animation: "confetti" })],
	["unknown mechanic", { ...voteRevoteBeat, mechanic: "quiz" }],
	[
		"missing duration route",
		{ ...voteRevoteBeat, routes: voteRevoteBeat.routes.slice(0, 2) },
	],
	[
		"opening longer than thirty seconds",
		replaceStage("opening", { suggestedSeconds: 31 }),
	],
	[
		"ordinary stage shorter than thirty seconds",
		replaceStage("first-discussion", { suggestedSeconds: 29 }),
	],
	[
		"ordinary stage longer than ninety seconds",
		replaceStage("route-evidence", { suggestedSeconds: 91 }),
	],
	[
		"projected question longer than its bound",
		{ ...voteRevoteBeat, question: "x".repeat(241) },
	],
	[
		"fewer than two choices",
		{ ...voteRevoteBeat, choices: [voteRevoteBeat.choices[0]] },
	],
	[
		"source duel without exactly two cards",
		{ ...sourceDuelBeat, sourceCards: [sourceDuelBeat.sourceCards[0]] },
	],
] as const;
