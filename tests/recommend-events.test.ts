import { describe, expect, it } from "vitest";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";
import { recommendEvents } from "../src/lib/content/recommend-events";

function event(
	slug: string,
	overrides: Partial<EventCatalogEntry> = {},
): EventCatalogEntry {
	return {
		slug,
		title: slug,
		date: { year: 1900, era: "ce", precision: "day", month: 6, day: 1 },
		summary: "Test event",
		topics: [],
		profiles: ["algemeen"],
		...overrides,
	};
}

const basePreferences = {
	selectedDate: "2026-06-01",
	yearMin: -3000,
	yearMax: 3000,
	profile: "algemeen" as const,
	topics: [] as string[],
};

describe("recommendEvents", () => {
	it("ranks events from the selected calendar week above distant dates", () => {
		const nearby = event("nearby", {
			date: { year: 1900, era: "ce", precision: "day", month: 6, day: 3 },
		});
		const distant = event("distant", {
			date: { year: 1900, era: "ce", precision: "day", month: 9, day: 1 },
		});

		const result = recommendEvents([distant, nearby], basePreferences);

		expect(result.events.map(({ event }) => event.slug)).toEqual([
			"nearby",
			"distant",
		]);
		expect(result.events[0]?.distanceDays).toBe(0);
	});

	it("treats a selected profile as an independent ranking signal", () => {
		const matching = event("z-matching", { profiles: ["elektriciteit"] });
		const other = event("a-other", { profiles: ["algemeen"] });

		const result = recommendEvents([other, matching], {
			...basePreferences,
			profile: "elektriciteit",
		});

		expect(result.events[0]?.event.slug).toBe("z-matching");
	});

	it("treats selected topics as an independent ranking signal", () => {
		const matching = event("z-matching", { topics: ["wetenschap"] });
		const other = event("a-other", { topics: ["politiek"] });

		const result = recommendEvents([other, matching], {
			...basePreferences,
			topics: ["wetenschap"],
		});

		expect(result.events[0]?.event.slug).toBe("z-matching");
	});

	it("filters signed historical years at period boundaries", () => {
		const beforeEra = event("before-era", {
			date: { year: 44, era: "bce", precision: "year" },
		});
		const afterEra = event("after-era", {
			date: { year: 44, era: "ce", precision: "year" },
		});

		const result = recommendEvents([afterEra, beforeEra], {
			...basePreferences,
			yearMin: -44,
			yearMax: -44,
		});

		expect(result.periodFallback).toBe(false);
		expect(result.events.map(({ event }) => event.slug)).toEqual([
			"before-era",
		]);
	});

	it("wraps calendar-week proximity across the end of the year", () => {
		const newYear = event("new-year", {
			date: { year: 1900, era: "ce", precision: "day", month: 1, day: 1 },
		});
		const distant = event("distant", {
			date: { year: 1900, era: "ce", precision: "day", month: 11, day: 1 },
		});

		const result = recommendEvents([distant, newYear], {
			...basePreferences,
			selectedDate: "2026-12-28",
		});

		expect(result.events[0]?.event.slug).toBe("new-year");
		expect(result.events[0]?.distanceDays).toBe(0);
	});

	it("uses slugs as a deterministic tie-breaker", () => {
		const result = recommendEvents(
			[event("zulu"), event("alpha"), event("mike")],
			basePreferences,
		);

		expect(result.events.map(({ event }) => event.slug)).toEqual([
			"alpha",
			"mike",
			"zulu",
		]);
	});

	it("falls back to the complete catalog only when the period is empty", () => {
		const catalog = [event("first"), event("second")];
		const result = recommendEvents(catalog, {
			...basePreferences,
			yearMin: 1500,
			yearMax: 1600,
		});

		expect(result.periodFallback).toBe(true);
		expect(result.events.map(({ event }) => event.slug).sort()).toEqual([
			"first",
			"second",
		]);
	});

	it("returns an empty non-fallback result for an empty catalog", () => {
		expect(recommendEvents([], basePreferences)).toEqual({
			events: [],
			periodFallback: false,
		});
	});
});
