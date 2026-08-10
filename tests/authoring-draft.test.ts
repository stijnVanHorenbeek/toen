import { describe, expect, it } from "vitest";
import {
	addExistingTopicToAuthoringDraft,
	addTopicToAuthoringDraft,
	createInitialAuthoringDraft,
	isInitialAuthoringDraft,
	normalizeTopic,
	parseStoredAuthoringDraft,
	toEventDraftInput,
	validateAuthoringStory,
} from "../src/lib/admin/authoring-draft";

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

	it("ignores malformed browser drafts instead of restoring unsafe data", () => {
		expect(parseStoredAuthoringDraft("not-json")).toBeNull();
		expect(
			parseStoredAuthoringDraft(
				JSON.stringify({ version: 1, step: 1, draft: { title: "Onvolledig" } }),
			),
		).toBeNull();
	});
});
