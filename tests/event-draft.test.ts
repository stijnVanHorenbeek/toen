import { describe, expect, it } from "vitest";
import { createEventDraftPreview } from "../src/lib/content/event-draft";

const validDraft = {
	slug: "val-van-constantinopel-1453",
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

describe("createEventDraftPreview", () => {
	it("returns a deterministic repository path and Markdown document", () => {
		const preview = createEventDraftPreview(validDraft);

		expect(preview.path).toBe("content/events/val-van-constantinopel-1453.md");
		expect(preview.markdown).toContain("title: Constantinopel valt");
		expect(preview.markdown).toContain("precision: day");
		expect(preview.markdown).toContain(
			"\n---\n\nDe stad werd na een beleg ingenomen.\n",
		);
	});

	it("rejects a slug that cannot be used as an event filename", () => {
		expect(() =>
			createEventDraftPreview({ ...validDraft, slug: "Ongeldige slug" }),
		).toThrow();
	});
});
