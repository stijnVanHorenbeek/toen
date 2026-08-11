import { describe, expect, it } from "vitest";
import {
	parseEventDocument,
	serializeEventDocument,
} from "../src/lib/content/event-document";
import { getAllEvents, getEventBySlug } from "../src/lib/content/events";

const slug = "d-day-de-geallieerde-landing-in-normandie-1944";

const canonicalDocument = `---
title: "D-Day: de geallieerde landing in Normandië"
date:
  year: 1944
  era: ce
  precision: day
  month: 6
  day: 6
summary: Op 6 juni 1944 begon met D-Day de bevrijding van West-Europa.
topics:
  - oorlog
  - europa
profiles:
  - auto-mechanica
sources:
  - title: D-Day
    publisher: United States Army
    url: https://www.army.mil/d-day/
---

Op 6 juni 1944 landden bijna 160.000 geallieerde militairen aan de kust van Normandië.
`;

describe("event documents", () => {
	it("parses and deterministically serializes canonical Markdown", () => {
		const event = parseEventDocument(slug, canonicalDocument);

		expect(event.slug).toBe(slug);
		expect(event.title).toBe("D-Day: de geallieerde landing in Normandië");
		expect(event.body).toBe(
			"Op 6 juni 1944 landden bijna 160.000 geallieerde militairen aan de kust van Normandië.",
		);
		expect(serializeEventDocument(event)).toBe(canonicalDocument);
	});

	it("persists selected topic labels in stable topic order", () => {
		const event = parseEventDocument(slug, canonicalDocument);
		const labeled = {
			...event,
			topics: ["europa", "cafe-cultuur"],
			topicLabels: {
				"cafe-cultuur": "Café-cultuur",
				europa: "Europa",
			},
		};

		const markdown = serializeEventDocument(labeled);
		expect(markdown).toContain(
			"topicLabels:\n  europa: Europa\n  cafe-cultuur: Café-cultuur\n",
		);
		expect(parseEventDocument(slug, markdown).topicLabels).toEqual({
			europa: "Europa",
			"cafe-cultuur": "Café-cultuur",
		});
	});

	it("rejects noncanonical topic identifiers and label keys", () => {
		const event = parseEventDocument(slug, canonicalDocument);
		expect(() =>
			serializeEventDocument({ ...event, topics: ["Café"] }),
		).toThrow();
		expect(() =>
			serializeEventDocument({
				...event,
				topicLabels: { "Café-cultuur": "Café-cultuur" },
			}),
		).toThrow();
		expect(() =>
			serializeEventDocument({
				...event,
				topicLabels: { ongebruikt: "Ongebruikt" },
			}),
		).toThrow();
	});

	it("loads a catalog event by its slug", async () => {
		const [event] = await getAllEvents();
		if (!event) throw new Error("Expected at least one synchronized event");

		await expect(getEventBySlug(event.slug)).resolves.toEqual(event);
	});
});
