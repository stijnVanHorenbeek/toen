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

	it("loads canonical events by slug", async () => {
		const events = await getAllEvents();
		const event = await getEventBySlug(slug);

		expect(events.map(({ slug: eventSlug }) => eventSlug)).toContain(slug);
		expect(event?.title).toBe("D-Day: de geallieerde landing in Normandië");
	});
});
