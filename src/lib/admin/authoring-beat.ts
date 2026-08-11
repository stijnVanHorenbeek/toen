import { z } from "zod";
import { beatResponseMethods, type InteractiveBeat } from "../content/event";

export type BeatResponseMethod = (typeof beatResponseMethods)[number];
export type AuthoringBeatMechanic = InteractiveBeat["mechanic"];
export type AuthoringBeatDuration = 5 | 8 | 12;

const authoringStageCommonSchema = {
	id: z.string(),
	suggestedSeconds: z.string(),
	teacherPrompt: z.string(),
	expectedStudentAction: z.string(),
};

export const authoringBeatStageSchema = z.discriminatedUnion("phase", [
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("opening"),
		stimulus: z.string(),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("commitment"),
		prompt: z.string(),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("evidence"),
		title: z.string(),
		evidence: z.string(),
		sourceId: z.string(),
		earliestDurationMinutes: z.union([
			z.literal(5),
			z.literal(8),
			z.literal(12),
		]),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("discussion"),
		prompt: z.string(),
		sentenceStarter: z.string(),
		earliestDurationMinutes: z.union([
			z.literal(5),
			z.literal(8),
			z.literal(12),
		]),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("revision"),
		prompt: z.string(),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("reasoning"),
		prompt: z.string(),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("resolution"),
		title: z.string(),
		feedback: z.string(),
		misconception: z.string(),
		sourceIds: z.array(z.string()),
	}),
	z.strictObject({
		...authoringStageCommonSchema,
		phase: z.literal("lesson-bridge"),
		bridge: z.string(),
	}),
]);

const sourceCardSchema = z.strictObject({
	id: z.string(),
	label: z.string(),
	excerpt: z.string(),
	sourceId: z.string(),
});

export const authoringBeatDraftSchema = z.strictObject({
	version: z.literal(2),
	mechanic: z.enum(["vote-revote", "source-duel", "context-decision"]),
	responseMethod: z.enum(beatResponseMethods),
	vocationalConnection: z.string(),
	question: z.string(),
	choices: z.array(
		z.strictObject({
			id: z.string(),
			label: z.string(),
		}),
	),
	stages: z.array(authoringBeatStageSchema),
	sensitivityNotes: z.array(z.string()),
	perspective: z.string(),
	sourceCards: z.tuple([sourceCardSchema, sourceCardSchema]),
});

export type AuthoringBeatStage = z.infer<typeof authoringBeatStageSchema>;
export type AuthoringBeatDraft = z.infer<typeof authoringBeatDraftSchema>;

type SourceReference = { id?: string; url: string };

export function createInitialAuthoringBeatDraft(
	sources: SourceReference[],
): AuthoringBeatDraft {
	const firstSourceId = sources[0]?.id ?? "source-1";
	const secondSourceId = sources[1]?.id ?? firstSourceId;
	return {
		version: 2,
		mechanic: "vote-revote",
		responseMethod: "hand-signals",
		vocationalConnection: "",
		question: "",
		choices: [
			{ id: "choice-a", label: "" },
			{ id: "choice-b", label: "" },
			{ id: "uncertain", label: "Nog niet zeker" },
		],
		stages: [
			{
				id: "opening",
				phase: "opening",
				suggestedSeconds: "20",
				teacherPrompt: "Toon de situatie zonder het antwoord te verklappen.",
				expectedStudentAction: "Lees en denk eerst zelfstandig na.",
				stimulus: "",
			},
			{
				id: "commitment",
				phase: "commitment",
				suggestedSeconds: "20",
				teacherPrompt: "Vraag iedereen om een eerste keuze te maken.",
				expectedStudentAction: "Kies vóór het gesprek één antwoord.",
				prompt: "Kies eerst voor jezelf. Je mag nog twijfelen.",
			},
			createEvidenceStage("evidence-5", 5, "50", firstSourceId),
			createDiscussionStage("discussion-5", 5, "60"),
			createEvidenceStage("evidence-8", 8, "60", secondSourceId),
			createDiscussionStage("discussion-8", 8, "60"),
			createEvidenceStage("evidence-12", 12, "70", firstSourceId),
			createDiscussionStage("discussion-12", 12, "60"),
			{
				id: "revision",
				phase: "revision",
				suggestedSeconds: "30",
				teacherPrompt: "Vraag opnieuw om een private keuze.",
				expectedStudentAction: "Behoud of wijzig je eerste antwoord.",
				prompt: "Kies opnieuw. Veranderen na bewijs is sterk redeneren.",
			},
			{
				id: "reasoning",
				phase: "reasoning",
				suggestedSeconds: "40",
				teacherPrompt: "Vraag naar een gewijzigde en een behouden keuze.",
				expectedStudentAction: "Verbind je antwoord aan concreet bewijs.",
				prompt: "Welk bewijs bepaalde je tweede keuze?",
			},
			{
				id: "resolution",
				phase: "resolution",
				suggestedSeconds: "60",
				teacherPrompt: "Verbind de keuze, het bewijs en de uitkomst.",
				expectedStudentAction: "Controleer je redenering met de uitkomst.",
				title: "",
				feedback: "",
				misconception: "",
				sourceIds: [firstSourceId],
			},
			{
				id: "lesson-bridge",
				phase: "lesson-bridge",
				suggestedSeconds: "30",
				teacherPrompt: "Verbind de activiteit met de rest van de les.",
				expectedStudentAction: "Formuleer één verband met het lesthema.",
				bridge: "",
			},
		],
		sensitivityNotes: [],
		perspective: "",
		sourceCards: [
			{ id: "source-a", label: "Bron A", excerpt: "", sourceId: firstSourceId },
			{
				id: "source-b",
				label: "Bron B",
				excerpt: "",
				sourceId: secondSourceId,
			},
		],
	};
}

function createEvidenceStage(
	id: string,
	earliestDurationMinutes: AuthoringBeatDuration,
	suggestedSeconds: string,
	sourceId: string,
): Extract<AuthoringBeatStage, { phase: "evidence" }> {
	return {
		id,
		phase: "evidence",
		suggestedSeconds,
		teacherPrompt: "Vraag welk detail de eerste keuze beïnvloedt.",
		expectedStudentAction: "Gebruik één detail om je keuze te toetsen.",
		title: "",
		evidence: "",
		sourceId,
		earliestDurationMinutes,
	};
}

function createDiscussionStage(
	id: string,
	earliestDurationMinutes: AuthoringBeatDuration,
	suggestedSeconds: string,
): Extract<AuthoringBeatStage, { phase: "discussion" }> {
	return {
		id,
		phase: "discussion",
		suggestedSeconds,
		teacherPrompt: "Laat beide partners één onderbouwde reden geven.",
		expectedStudentAction: "Vergelijk redenen met een partner.",
		prompt: "",
		sentenceStarter: "",
		earliestDurationMinutes,
	};
}

export function clearAuthoringBeatSourceReferences(
	beat: AuthoringBeatDraft,
	sourceId: string,
): AuthoringBeatDraft {
	return {
		...beat,
		stages: beat.stages.map((stage) => {
			if (stage.phase === "evidence" && stage.sourceId === sourceId) {
				return { ...stage, sourceId: "" };
			}
			if (stage.phase === "resolution") {
				return {
					...stage,
					sourceIds: stage.sourceIds.filter((value) => value !== sourceId),
				};
			}
			return stage;
		}),
		sourceCards: beat.sourceCards.map((card) =>
			card.sourceId === sourceId ? { ...card, sourceId: "" } : card,
		) as AuthoringBeatDraft["sourceCards"],
	};
}

export function toCanonicalInteractiveBeat(
	beat: AuthoringBeatDraft,
	sources: SourceReference[],
): InteractiveBeat {
	const sourceUrl = (sourceId: string) =>
		sources.find(({ id }) => id === sourceId)?.url.trim() ?? "";
	const stages = beat.stages.map((stage) => {
		const common = {
			id: stage.id,
			phase: stage.phase,
			suggestedSeconds: Number(stage.suggestedSeconds),
			teacherPrompt: stage.teacherPrompt.trim(),
			expectedStudentAction: stage.expectedStudentAction.trim(),
		};
		switch (stage.phase) {
			case "opening":
				return { ...common, stimulus: stage.stimulus.trim() };
			case "commitment":
			case "revision":
			case "reasoning":
				return {
					...common,
					prompt: stage.prompt.trim(),
					...(stage.phase === "reasoning" ? { optional: true as const } : {}),
				};
			case "discussion":
				return {
					...common,
					prompt: stage.prompt.trim(),
					...(stage.sentenceStarter.trim()
						? { sentenceStarter: stage.sentenceStarter.trim() }
						: {}),
					...(stage.earliestDurationMinutes > 5
						? { optional: true as const }
						: {}),
				};
			case "evidence":
				return {
					...common,
					title: stage.title.trim(),
					evidence: stage.evidence.trim(),
					sourceUrl: sourceUrl(stage.sourceId),
					earliestDurationMinutes: stage.earliestDurationMinutes,
					...(stage.earliestDurationMinutes > 5
						? { optional: true as const }
						: {}),
				};
			case "resolution":
				return {
					...common,
					title: stage.title.trim(),
					feedback: stage.feedback.trim(),
					...(stage.misconception.trim()
						? { misconception: stage.misconception.trim() }
						: {}),
					sourceUrls: stage.sourceIds.map(sourceUrl),
				};
			case "lesson-bridge":
				return { ...common, bridge: stage.bridge.trim() };
		}
		throw new Error("Onbekende activiteitfase");
	});
	const routes = ([5, 8, 12] as const).map((durationMinutes) => ({
		durationMinutes,
		stageIds: stages.flatMap((stage) =>
			includedInDuration(beat, stage.id, durationMinutes) ? [stage.id] : [],
		),
	})) as InteractiveBeat["routes"];
	const common = {
		version: 2 as const,
		mechanic: beat.mechanic,
		responseMethod: beat.responseMethod,
		...(beat.vocationalConnection.trim()
			? { vocationalConnection: beat.vocationalConnection.trim() }
			: {}),
		question: beat.question.trim(),
		choices: beat.choices.map(({ id, label }) => ({ id, label: label.trim() })),
		stages,
		routes,
		...(beat.sensitivityNotes.some((note) => note.trim())
			? {
					sensitivityNotes: beat.sensitivityNotes
						.map((note) => note.trim())
						.filter(Boolean),
				}
			: {}),
	};
	if (beat.mechanic === "source-duel") {
		return {
			...common,
			mechanic: "source-duel",
			sourceCards: beat.sourceCards.map((card) => ({
				id: card.id,
				label: card.label.trim(),
				excerpt: card.excerpt.trim(),
				sourceUrl: sourceUrl(card.sourceId),
			})) as [
				{ id: string; label: string; excerpt: string; sourceUrl: string },
				{ id: string; label: string; excerpt: string; sourceUrl: string },
			],
		} as InteractiveBeat;
	}
	if (beat.mechanic === "context-decision") {
		return {
			...common,
			mechanic: "context-decision",
			perspective: beat.perspective.trim(),
		} as InteractiveBeat;
	}
	return { ...common, mechanic: "vote-revote" } as InteractiveBeat;
}

function includedInDuration(
	beat: AuthoringBeatDraft,
	stageId: string,
	durationMinutes: AuthoringBeatDuration,
): boolean {
	const stage = beat.stages.find(({ id }) => id === stageId);
	if (!stage) return false;
	if (stage.phase === "evidence" || stage.phase === "discussion") {
		return stage.earliestDurationMinutes <= durationMinutes;
	}
	if (stage.phase === "reasoning") return durationMinutes >= 8;
	return true;
}
