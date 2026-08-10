import { describe, expect, it } from "vitest";
import {
	collectTopicLabels,
	toEventCatalogEntry,
} from "../src/lib/content/event-catalog";
import type { Event } from "../src/lib/content/event-document";

const event: Event = {
	slug: "cafe-cultuur-1900",
	title: "Cafécultuur",
	date: { year: 1900, era: "ce", precision: "year" },
	summary: "Samenvatting",
	body: "Verhaal",
	topics: ["cafe-cultuur"],
	topicLabels: { "cafe-cultuur": "Café-cultuur" },
	profiles: ["algemeen"],
	sources: [
		{ title: "Bron", publisher: "Uitgever", url: "https://example.org" },
	],
};

describe("compact event catalog", () => {
	it("carries topic labels without carrying the body or sources", () => {
		expect(toEventCatalogEntry(event)).toEqual({
			slug: event.slug,
			title: event.title,
			date: event.date,
			summary: event.summary,
			topics: event.topics,
			topicLabels: event.topicLabels,
			profiles: event.profiles,
		});
	});

	it("resolves duplicate topic labels deterministically from first event", () => {
		expect(
			collectTopicLabels([
				event,
				{ ...event, topicLabels: { "cafe-cultuur": "Andere naam" } },
			]),
		).toEqual({ "cafe-cultuur": "Café-cultuur" });
	});
});
