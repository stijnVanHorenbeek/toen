import { describe, expect, it } from "vitest";
import { clearAuthoringBeatSourceReferences } from "../src/lib/admin/authoring-beat";
import {
	addExistingTopicToAuthoringDraft,
	addTopicToAuthoringDraft,
	createInitialAuthoringBeatDraft,
	createInitialAuthoringDraft,
	isInitialAuthoringDraft,
	normalizeTopic,
	parseStoredAuthoringDraft,
	selectStoredAuthoringDraft,
	toEventDraftInput,
	validateAuthoringStory,
} from "../src/lib/admin/authoring-draft";
import { parseEventDraft } from "../src/lib/content/event-draft";

describe("authoring draft conversion", () => {
	it("converts an exact CE date field to canonical date parts", () => {
		const draft = createInitialAuthoringDraft();
		draft.title = "Constantinopel valt";
		draft.exactDate = "1453-05-29";
		draft.summary = "Ottomaanse troepen nemen de stad in.";
		draft.body = "Het verhaal.";
		draft.profiles = ["algemeen"];
		draft.topics = ["politiek"];
		draft.sources = [
			{ title: "Bron", publisher: "Uitgever", url: "https://example.org" },
		];

		expect(toEventDraftInput(draft).date).toEqual({
			year: 1453,
			era: "ce",
			precision: "day",
			month: 5,
			day: 29,
		});
	});

	it("parses a typed nl-BE exact date without Gregorian leap-year rejection", () => {
		const draft = createInitialAuthoringDraft();
		draft.exactDate = "29.02.1500";

		expect(toEventDraftInput(draft).date).toEqual({
			year: 1500,
			era: "ce",
			precision: "day",
			month: 2,
			day: 29,
		});
	});

	it("treats a short year with normalized separators as nl-BE order", () => {
		const draft = createInitialAuthoringDraft();
		draft.exactDate = "29-02-44";

		expect(toEventDraftInput(draft).date).toMatchObject({
			year: 44,
			month: 2,
			day: 29,
		});
	});

	it("preserves circa BCE without invented month or day", () => {
		const draft = createInitialAuthoringDraft();
		draft.precision = "approximate";
		draft.era = "bce";
		draft.year = "44";

		expect(toEventDraftInput(draft).date).toEqual({
			year: 44,
			era: "bce",
			precision: "approximate",
		});
	});

	it("preserves month-only and year-only dates without false precision", () => {
		const monthDraft = createInitialAuthoringDraft();
		monthDraft.precision = "month";
		monthDraft.year = "1918";
		monthDraft.month = "11";

		expect(toEventDraftInput(monthDraft).date).toEqual({
			year: 1918,
			era: "ce",
			precision: "month",
			month: 11,
		});

		const yearDraft = createInitialAuthoringDraft();
		yearDraft.precision = "year";
		yearDraft.era = "bce";
		yearDraft.year = "753";

		expect(toEventDraftInput(yearDraft).date).toEqual({
			year: 753,
			era: "bce",
			precision: "year",
		});
	});

	it("normalizes a new topic while retaining its visible label", () => {
		expect(normalizeTopic("Lokale geschiedenis")).toBe("lokale-geschiedenis");
		expect(normalizeTopic("België")).toBe("belgie");

		const draft = addTopicToAuthoringDraft(
			createInitialAuthoringDraft(),
			"Café-cultuur",
		);
		expect(draft.topics).toEqual(["cafe-cultuur"]);
		expect(draft.topicLabels).toEqual({ "cafe-cultuur": "Café-cultuur" });
		expect(toEventDraftInput(draft)).toMatchObject({
			topics: ["cafe-cultuur"],
			topicLabels: { "cafe-cultuur": "Café-cultuur" },
		});
	});

	it("preserves an existing canonical topic ID separately from its label", () => {
		const draft = addExistingTopicToAuthoringDraft(
			createInitialAuthoringDraft(),
			"industrial-revolution",
			"Industriële revolutie",
		);
		expect(toEventDraftInput(draft)).toMatchObject({
			topics: ["industrial-revolution"],
			topicLabels: { "industrial-revolution": "Industriële revolutie" },
		});
	});

	it("detects only the complete initial draft as empty", () => {
		const initial = createInitialAuthoringDraft();
		expect(isInitialAuthoringDraft(initial)).toBe(true);
		expect(isInitialAuthoringDraft({ ...initial, year: "1453" })).toBe(false);
		expect(
			isInitialAuthoringDraft({
				...initial,
				sources: [{ ...initial.sources[0], title: "Bron" }],
			}),
		).toBe(false);
	});

	it("uses locale fallback instead of storing a raw catalog identifier", () => {
		const draft = addTopicToAuthoringDraft(
			createInitialAuthoringDraft(),
			"belgie",
		);
		expect(draft.topics).toEqual(["belgie"]);
		expect(draft.topicLabels).toEqual({});
	});

	it("converts a constrained beat draft to canonical version 2 routes and sources", () => {
		const draft = createInitialAuthoringDraft();
		draft.sources = [
			{
				id: "source-a",
				title: "Bron A",
				publisher: "Archief",
				url: "https://example.org/a",
			},
			{
				id: "source-b",
				title: "Bron B",
				publisher: "Archief",
				url: "https://example.org/b",
			},
		];
		draft.beat = createInitialAuthoringBeatDraft(draft.sources);
		completeBeat(draft.beat);

		const input = toEventDraftInput(draft);

		expect(input.beat).toMatchObject({
			version: 2,
			mechanic: "vote-revote",
			responseMethod: "hand-signals",
			vocationalConnection: "Link met veilig werken.",
			routes: [
				{ durationMinutes: 5 },
				{ durationMinutes: 8 },
				{ durationMinutes: 12 },
			],
		});
		expect(input.beat?.stages[2]).toMatchObject({
			phase: "evidence",
			sourceUrl: "https://example.org/a",
			earliestDurationMinutes: 5,
		});
		expect(input.beat?.routes.map(({ stageIds }) => stageIds.length)).toEqual([
			7, 10, 12,
		]);

		for (const stage of [draft.beat.stages[4], draft.beat.stages[5]]) {
			if (stage.phase === "evidence" || stage.phase === "discussion") {
				stage.earliestDurationMinutes = 12;
			}
		}
		expect(
			toEventDraftInput(draft).beat?.routes.map(
				({ stageIds }) => stageIds.length,
			),
		).toEqual([7, 8, 12]);
	});

	it("converts all three constrained mechanics", () => {
		const draft = createInitialAuthoringDraft();
		draft.sources = [
			{
				id: "source-a",
				title: "A",
				publisher: "P",
				url: "https://example.org/a",
			},
			{
				id: "source-b",
				title: "B",
				publisher: "P",
				url: "https://example.org/b",
			},
		];
		draft.title = "Testactiviteit";
		draft.precision = "year";
		draft.year = "1969";
		draft.summary = "Een samenvatting.";
		draft.body = "Een verhaal.";
		draft.profiles = ["algemeen"];
		draft.topics = ["wetenschap"];
		draft.beat = createInitialAuthoringBeatDraft(draft.sources);
		completeBeat(draft.beat);
		draft.beat.mechanic = "source-duel";
		draft.beat.sourceCards[0].excerpt = "Fragment A";
		draft.beat.sourceCards[1].excerpt = "Fragment B";
		const sourceDuelInput = toEventDraftInput(draft);
		expect(sourceDuelInput.beat).toMatchObject({
			mechanic: "source-duel",
			sourceCards: [
				{ sourceUrl: "https://example.org/a" },
				{ sourceUrl: "https://example.org/b" },
			],
		});
		expect(parseEventDraft(sourceDuelInput).beat?.mechanic).toBe("source-duel");

		draft.beat.mechanic = "context-decision";
		draft.beat.perspective = "Adviseer met wat toen bekend was.";
		const contextDecisionInput = toEventDraftInput(draft);
		expect(contextDecisionInput.beat).toMatchObject({
			mechanic: "context-decision",
			perspective: "Adviseer met wat toen bekend was.",
		});
		expect(parseEventDraft(contextDecisionInput).beat?.mechanic).toBe(
			"context-decision",
		);
	});

	it("migrates version 1 browser drafts and restores version 2 beat edits", () => {
		const legacy = createInitialAuthoringDraft();
		const { beat: _beat, topicLabels: _topicLabels, ...oldDraft } = legacy;
		const migrated = parseStoredAuthoringDraft(
			JSON.stringify({ version: 1, step: 3, draft: oldDraft }),
		);
		expect(migrated).toMatchObject({ step: 2, draft: { beat: null } });

		const current = createInitialAuthoringDraft();
		current.beat = createInitialAuthoringBeatDraft(current.sources);
		current.beat.question = "Bewaarde vraag";
		const restored = parseStoredAuthoringDraft(
			JSON.stringify({ version: 2, step: 4, draft: current }),
		);
		expect(restored).toMatchObject({
			step: 3,
			draft: { beat: { question: "Bewaarde vraag" } },
		});
		expect(isInitialAuthoringDraft(current)).toBe(false);
	});

	it("falls back to a valid legacy draft when current storage is malformed", () => {
		const legacy = createInitialAuthoringDraft();
		const { beat: _beat, topicLabels: _topicLabels, ...oldDraft } = legacy;
		oldDraft.title = "Legacy blijft bewaard";

		expect(
			selectStoredAuthoringDraft(
				JSON.stringify({ version: 2, step: 3, draft: { broken: true } }),
				JSON.stringify({ version: 1, step: 1, draft: oldDraft }),
			),
		).toMatchObject({
			step: 1,
			draft: { title: "Legacy blijft bewaard", beat: null },
		});
	});

	it("clears removed source references without retargeting evidence", () => {
		const sources = [
			{ id: "source-a", url: "https://example.org/a" },
			{ id: "source-b", url: "https://example.org/b" },
		];
		const beat = createInitialAuthoringBeatDraft(sources);
		const cleared = clearAuthoringBeatSourceReferences(beat, "source-a");

		expect(
			cleared.stages
				.filter((stage) => stage.phase === "evidence")
				.map((stage) => stage.sourceId),
		).toEqual(["", "source-b", ""]);
		expect(cleared.sourceCards.map(({ sourceId }) => sourceId)).toEqual([
			"",
			"source-b",
		]);
		const resolution = cleared.stages.find(
			(stage) => stage.phase === "resolution",
		);
		expect(resolution?.phase === "resolution" && resolution.sourceIds).toEqual(
			[],
		);
	});

	it("restores old drafts without topic labels", () => {
		const draft = createInitialAuthoringDraft();
		const { topicLabels: _topicLabels, ...oldDraft } = draft;
		const restored = parseStoredAuthoringDraft(
			JSON.stringify({ version: 1, step: 1, draft: oldDraft }),
		);
		expect(restored?.draft.topicLabels).toEqual({});

		const labeled = parseStoredAuthoringDraft(
			JSON.stringify({
				version: 1,
				step: 2,
				draft: {
					...draft,
					topics: ["cafe-cultuur"],
					topicLabels: { "cafe-cultuur": "Café-cultuur" },
				},
			}),
		);
		expect(labeled?.draft.topicLabels).toEqual({
			"cafe-cultuur": "Café-cultuur",
		});
	});

	it("rejects non-positive and fractional BCE days before continuing", () => {
		for (const day of ["-1", "0", "1.5"]) {
			const draft = createInitialAuthoringDraft();
			draft.era = "bce";
			draft.year = "44";
			draft.month = "4";
			draft.day = day;
			draft.title = "Test";
			draft.summary = "Samenvatting";
			draft.body = "Verhaal";
			expect(validateAuthoringStory(draft).day).toBe(
				"Vul een hele dag groter dan 0 in.",
			);
		}
	});

	it("reports impossible days and non-positive years on their fields", () => {
		const draft = createInitialAuthoringDraft();
		draft.era = "bce";
		draft.year = "44";
		draft.month = "4";
		draft.day = "31";
		draft.title = "Test";
		draft.summary = "Samenvatting";
		draft.body = "Verhaal";

		expect(validateAuthoringStory(draft).day).toBe(
			"Kies een mogelijke dag voor deze maand.",
		);
		draft.day = "1";
		draft.year = "0";
		expect(validateAuthoringStory(draft).year).toBe(
			"Vul een jaar groter dan 0 in.",
		);
	});

	it("ignores malformed browser drafts instead of restoring unsafe data", () => {
		expect(parseStoredAuthoringDraft("not-json")).toBeNull();
		expect(
			parseStoredAuthoringDraft(
				JSON.stringify({ version: 1, step: 1, draft: { title: "Onvolledig" } }),
			),
		).toBeNull();
	});
});

function completeBeat(
	beat: ReturnType<typeof createInitialAuthoringBeatDraft>,
) {
	beat.question = "Welke keuze maak je?";
	beat.vocationalConnection = "Link met veilig werken.";
	beat.choices.forEach((choice, index) => {
		choice.label = `Keuze ${index + 1}`;
	});
	for (const stage of beat.stages) {
		switch (stage.phase) {
			case "opening":
				stage.stimulus = "Een historische situatie.";
				break;
			case "commitment":
			case "discussion":
			case "revision":
			case "reasoning":
				stage.prompt = "Bespreek je keuze.";
				break;
			case "evidence":
				stage.title = "Nieuwe bron";
				stage.evidence = "De bron voegt historische informatie toe.";
				break;
			case "resolution":
				stage.title = "Wat gebeurde er?";
				stage.feedback = "De historische uitkomst en verklaring.";
				break;
			case "lesson-bridge":
				stage.bridge = "Wat neem je mee naar de les?";
				break;
		}
	}
}
