import { describe, expect, it } from "vitest";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";
import { createEventSearchRuntime } from "../src/lib/content/event-search-runtime";
import {
	createEventSearchArtifact,
	parseEventSearchArtifact,
} from "../src/lib/content/search-artifact";
import { createSearchRequestSequence } from "../src/lib/content/search-request-sequence";

const releaseId = "a".repeat(64);
const preferences = {
	selectedDate: "2026-06-01",
	yearMin: -3000,
	yearMax: 3000,
	topics: [] as string[],
	query: "",
};

function event(index: number): EventCatalogEntry {
	const sequence = String(index).padStart(2, "0");
	return {
		slug: `event-${sequence}`,
		title: `Gebeurtenis ${sequence}`,
		date: {
			year: 1900 + index,
			era: "ce",
			precision: "day",
			month: 6,
			day: 1,
		},
		summary: `Samenvatting ${sequence}`,
		topics: ["geschiedenis"],
		topicLabels: { geschiedenis: "Historisch thema" },
	};
}

describe("event search artifact", () => {
	it("round-trips a release-qualified bounded catalog", () => {
		const artifact = createEventSearchArtifact(
			Array.from({ length: 30 }, (_, index) => event(index)),
			{ releaseId },
		);

		expect(
			parseEventSearchArtifact(JSON.parse(JSON.stringify(artifact))),
		).toEqual(artifact);
		expect(artifact).toMatchObject({
			schemaVersion: 1,
			releaseId,
			topicLabels: { geschiedenis: "Historisch thema" },
		});
	});

	it("rejects malformed or unbounded public input", () => {
		expect(() =>
			parseEventSearchArtifact({
				schemaVersion: 2,
				releaseId,
				topicLabels: {},
				events: [],
			}),
		).toThrow("schema version");
		expect(() =>
			parseEventSearchArtifact({
				schemaVersion: 1,
				releaseId,
				topicLabels: {},
				events: Array.from({ length: 10_001 }, (_, index) => event(index)),
			}),
		).toThrow("at most 10000 events");
	});
});

describe("search request sequence", () => {
	it("invalidates an in-flight response as soon as filters change", () => {
		const sequence = createSearchRequestSequence();
		const inFlight = sequence.next();

		sequence.invalidate();

		expect(sequence.isCurrent(inFlight)).toBe(false);
		expect(sequence.isCurrent(sequence.next())).toBe(true);
	});
});

describe("event search runtime", () => {
	it("loads once and returns only requested result page", async () => {
		const artifact = createEventSearchArtifact(
			Array.from({ length: 60 }, (_, index) => event(index)),
			{ releaseId },
		);
		let loads = 0;
		const runtime = createEventSearchRuntime(async (url) => {
			loads += 1;
			expect(url).toBe(`/releases/${releaseId}/search.json`);
			return artifact;
		});
		const indexUrl = `/releases/${releaseId}/search.json`;

		await runtime.preload(indexUrl);
		const response = await runtime.search({
			kind: "search",
			requestId: 7,
			indexUrl,
			preferences: { ...preferences, query: "historisch" },
			offset: 24,
			limit: 24,
		});

		expect(loads).toBe(1);
		expect(response).toMatchObject({
			kind: "result",
			requestId: 7,
			offset: 24,
			totalCount: 60,
		});
		expect(response.events).toHaveLength(24);
		expect(response.events[0]?.event.slug).toBe("event-24");
		await expect(
			runtime.preload(`https://example.com/releases/${releaseId}/search.json`),
		).rejects.toThrow("same-origin relative");
	});
});
