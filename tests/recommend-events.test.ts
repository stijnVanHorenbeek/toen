import { describe, expect, it } from "vitest";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";
import { recommendEvents } from "../src/lib/content/recommend-events";

const events: EventCatalogEntry[] = [
	{
		slug: "d-day-1944",
		title: "D-Day",
		date: { year: 1944, era: "ce", precision: "day", month: 6, day: 6 },
		summary: "Landing in Normandië.",
		topics: ["oorlog"],
		profiles: ["auto-mechanica"],
	},
	{
		slug: "apollo-11-1969",
		title: "Apollo 11",
		date: { year: 1969, era: "ce", precision: "day", month: 7, day: 20 },
		summary: "Mensen landen op de maan.",
		topics: ["wetenschap", "technologie"],
		profiles: ["elektriciteit", "metaal"],
	},
	{
		slug: "belgie-1830",
		title: "België wordt onafhankelijk",
		date: { year: 1830, era: "ce", precision: "day", month: 10, day: 4 },
		summary: "België verklaart zich onafhankelijk.",
		topics: ["belgie", "politiek"],
		profiles: ["algemeen"],
	},
];

describe("recommendEvents", () => {
	it("ranks nearby profile and topic matches without excluding alternatives", () => {
		const result = recommendEvents(events, {
			selectedDate: "2026-07-20",
			yearMin: 1800,
			yearMax: 2000,
			profile: "elektriciteit",
			topics: ["wetenschap"],
		});

		expect(result.periodFallback).toBe(false);
		expect(result.events[0]?.event.slug).toBe("apollo-11-1969");
		expect(result.events).toHaveLength(3);
	});

	it("falls back to nearby events when the selected period has no content", () => {
		const result = recommendEvents(events, {
			selectedDate: "2026-08-10",
			yearMin: 1500,
			yearMax: 1600,
			profile: "algemeen",
			topics: [],
		});

		expect(result.periodFallback).toBe(true);
		expect(result.events.length).toBeGreaterThan(0);
	});
});
