import { describe, expect, it } from "vitest";
import { interactiveBeatSchema } from "../src/lib/content/event";
import {
	collectTopicLabels,
	toEventCatalogEntry,
} from "../src/lib/content/event-catalog";
import type { Event } from "../src/lib/content/event-document";
import { beatSources, voteRevoteBeat } from "./fixtures/interactive-beat";

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
		});
	});

	it("exposes compact activity metadata without classroom payload", () => {
		const runnableEvent: Event = {
			...event,
			sources: beatSources.map((source) => ({ ...source })),
			beat: interactiveBeatSchema.parse(voteRevoteBeat),
		};

		expect(toEventCatalogEntry(runnableEvent)).toMatchObject({
			activity: {
				mechanic: "vote-revote",
				question: voteRevoteBeat.question,
				durations: [5, 8, 12],
			},
		});
		expect(toEventCatalogEntry(runnableEvent)).not.toHaveProperty(
			"activity.stages",
		);
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
