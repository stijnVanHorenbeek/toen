import { describe, expect, it } from "vitest";
import {
	createEventDraftPreview,
	inferEventSlug,
	parseEventDraft,
} from "../src/lib/content/event-draft";
import { beatSources, voteRevoteBeat } from "./fixtures/interactive-beat";

const validDraft = {
	title: "Constantinopel valt",
	date: {
		year: 1453,
		era: "ce",
		precision: "day",
		month: 5,
		day: 29,
	},
	summary: "Ottomaanse troepen nemen Constantinopel in.",
	topics: ["politiek", "oorlog"],
	profiles: ["algemeen"],
	sources: [
		{
			title: "Fall of Constantinople",
			publisher: "Encyclopaedia Britannica",
			url: "https://www.britannica.com/event/Fall-of-Constantinople-1453",
		},
	],
	body: "De stad werd na een beleg ingenomen.",
};

describe("inferEventSlug", () => {
	it("derives an ASCII slug from title, year, and era", () => {
		expect(
			inferEventSlug("België wordt onafhankelijk", {
				year: 1830,
				era: "ce",
			}),
		).toBe("belgie-wordt-onafhankelijk-1830");
		expect(inferEventSlug("Julius Caesar", { year: 44, era: "bce" })).toBe(
			"julius-caesar-44-bce",
		);
	});
});

describe("createEventDraftPreview", () => {
	it("returns a deterministic repository path and Markdown document", () => {
		const preview = createEventDraftPreview(validDraft);

		expect(preview.path).toBe("content/events/constantinopel-valt-1453.md");
		expect(preview.event.slug).toBe("constantinopel-valt-1453");
		expect(preview.markdown).toContain("title: Constantinopel valt");
		expect(preview.markdown).toContain("precision: day");
		expect(preview.markdown).toContain(
			"\n---\n\nDe stad werd na een beleg ingenomen.\n",
		);
	});

	it("ignores a browser-provided slug and derives the path again", () => {
		expect(
			createEventDraftPreview({
				...validDraft,
				slug: "door-browser-gekozen",
			}).path,
		).toBe("content/events/constantinopel-valt-1453.md");
	});

	it("rejects a title that cannot produce a valid event address", () => {
		expect(() =>
			createEventDraftPreview({ ...validDraft, title: "!!!" }),
		).toThrow("Schrijf een titel met letters of cijfers");
	});

	it("rejects labels for topics that are not selected", () => {
		expect(() =>
			createEventDraftPreview({
				...validDraft,
				topicLabels: { economie: "Economie" },
			}),
		).toThrow();
	});

	it("preserves a valid beat in the publication preview", () => {
		const preview = createEventDraftPreview({
			...validDraft,
			sources: beatSources,
			beat: voteRevoteBeat,
		});

		expect(preview.event.beat).toEqual(voteRevoteBeat);
		expect(preview.markdown).toContain("\nbeat:\n");
	});

	it("rejects beat sources that do not belong to the draft event", () => {
		const invalidBeat = {
			...voteRevoteBeat,
			stages: voteRevoteBeat.stages.map((stage) =>
				stage.id === "route-evidence"
					? { ...stage, sourceUrl: "https://example.org/invented" }
					: stage,
			),
		};

		expect(() =>
			parseEventDraft({
				...validDraft,
				sources: beatSources,
				beat: invalidBeat,
			}),
		).toThrow();
	});

	it("rejects unsupported or unsafe story Markdown", () => {
		for (const body of [
			"[onveilig](javascript:alert(1))",
			"# Paginatitel",
			"#### Te diepe kop",
		]) {
			expect(() => createEventDraftPreview({ ...validDraft, body })).toThrow();
		}
	});
});
