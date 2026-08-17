import { describe, expect, it } from "vitest";
import {
	createPeriodArchives,
	createTopicArchives,
} from "../src/lib/content/event-archives";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";

function event(
	slug: string,
	year: number,
	era: "bce" | "ce",
	topics: string[],
): EventCatalogEntry {
	return {
		slug,
		title: slug,
		date: { year, era, precision: "year" },
		summary: slug,
		topics,
		topicLabels: Object.fromEntries(
			topics.map((topic) => [topic, `Label ${topic}`]),
		),
	};
}

describe("static event archives", () => {
	const events = [
		event("roman", 44, "bce", ["politiek"]),
		event("modern", 1969, "ce", ["wetenschap", "politiek"]),
		event("future", 2026, "ce", ["wetenschap"]),
	];

	it("partitions signed years into at most 24 deterministic archives", () => {
		const periods = createPeriodArchives(events);

		expect(periods.length).toBeLessThanOrEqual(24);
		expect(periods.flatMap((period) => period.events)).toHaveLength(3);
		expect(new Set(periods.map((period) => period.id)).size).toBe(
			periods.length,
		);
		expect(periods[0]?.minimumYear).toBe(-44);
		expect(periods.at(-1)?.maximumYear).toBe(2026);
	});

	it("creates bounded topic archives with localized labels", () => {
		const topics = createTopicArchives(events);

		expect(topics.map(({ id }) => id)).toEqual(["politiek", "wetenschap"]);
		expect(topics[0]).toMatchObject({
			id: "politiek",
			label: "Label politiek",
		});
		expect(topics[0]?.events.map(({ slug }) => slug)).toEqual([
			"roman",
			"modern",
		]);
	});
});
