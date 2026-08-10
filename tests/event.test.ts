import { describe, expect, it } from "vitest";
import { parseEventFrontmatter } from "../src/lib/content/event";

const validFrontmatter = {
	title: "D-Day: de geallieerde landing in Normandië",
	date: {
		year: 1944,
		era: "ce",
		precision: "day",
		month: 6,
		day: 6,
	},
	summary: "Geallieerde troepen landden aan de kust van Normandië.",
	topics: ["oorlog"],
	profiles: ["auto-mechanica"],
	sources: [
		{
			title: "D-Day",
			publisher: "United States Army",
			url: "https://www.army.mil/d-day/",
		},
	],
};

describe("parseEventFrontmatter", () => {
	it("accepts valid event frontmatter", () => {
		expect(parseEventFrontmatter(validFrontmatter)).toEqual(validFrontmatter);
	});

	it("rejects day precision without a complete month and day", () => {
		expect(() =>
			parseEventFrontmatter({
				...validFrontmatter,
				date: {
					year: 1944,
					era: "ce",
					precision: "day",
				},
			}),
		).toThrow();
	});
});
