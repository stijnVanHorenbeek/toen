import { describe, expect, it } from "vitest";
import {
	formatHistoricalDate,
	parseEventFrontmatter,
} from "../src/lib/content/event";

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

describe("historical events", () => {
	it("formats approximate BCE dates without false precision", () => {
		expect(
			formatHistoricalDate({ year: 1944, era: "ce", precision: "year" }),
		).toBe("1944");
		expect(
			formatHistoricalDate({ year: 44, era: "bce", precision: "approximate" }),
		).toBe("ca. 44 v.Chr.");
		expect(
			formatHistoricalDate({
				year: 66_000_000,
				era: "bce",
				precision: "approximate",
			}),
		).toBe("ca. 66.000.000 v.Chr.");
	});

	it("accepts valid event frontmatter", () => {
		expect(parseEventFrontmatter(validFrontmatter)).toEqual(validFrontmatter);
	});

	it("rejects topic labels for topics that are not selected", () => {
		expect(() =>
			parseEventFrontmatter({
				...validFrontmatter,
				topicLabels: { politiek: "Politiek" },
			}),
		).toThrow();
	});

	it("rejects unknown vakrichting identifiers", () => {
		expect(() =>
			parseEventFrontmatter({
				...validFrontmatter,
				profiles: ["onbekende-richting"],
			}),
		).toThrow();
	});

	it("accepts only HTTP source URLs", () => {
		for (const url of [
			"geen-url",
			"javascript:alert(1)",
			"data:text/plain,test",
			"ftp://example.org/source",
		]) {
			expect(() =>
				parseEventFrontmatter({
					...validFrontmatter,
					sources: [{ ...validFrontmatter.sources[0], url }],
				}),
			).toThrow();
		}
		expect(() =>
			parseEventFrontmatter({
				...validFrontmatter,
				sources: [
					{ ...validFrontmatter.sources[0], url: "https://example.org/source" },
				],
			}),
		).not.toThrow();
	});

	it("rejects an obviously impossible historical day", () => {
		expect(() =>
			parseEventFrontmatter({
				...validFrontmatter,
				date: { ...validFrontmatter.date, month: 4, day: 31 },
			}),
		).toThrow();
		expect(() =>
			parseEventFrontmatter({
				...validFrontmatter,
				date: { ...validFrontmatter.date, month: 2, day: 30 },
			}),
		).toThrow();
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
