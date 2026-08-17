import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventExplorer } from "../src/app/_components/event-explorer/event-explorer";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";

const activity: EventCatalogEntry = {
	slug: "test-activity",
	title: "Testactiviteit",
	date: { year: 1918, era: "ce", precision: "year" },
	summary: "Testsamenvatting",
	topics: ["politiek"],
	activity: {
		mechanic: "vote-revote",
		question: "Welke keuze maak je?",
		durations: [5, 8, 12],
	},
};

describe("EventExplorer", () => {
	it("uses curated imagery to make recommendations visually distinct", () => {
		const markup = renderToStaticMarkup(
			<EventExplorer events={[{ ...activity, slug: "apollo-11-1969" }]} />,
		);

		expect(markup).toContain('src="/media/events/apollo-11-aldrin.webp"');
		expect(markup).toContain('alt="Buzz Aldrin staat op het maanoppervlak');
	});

	it("offers classroom launch and background reading for runnable events", () => {
		const markup = renderToStaticMarkup(<EventExplorer events={[activity]} />);

		expect(markup).toContain('href="/events/test-activity/play"');
		expect(markup).toContain('href="/events/test-activity"');
	});

	it("keeps recommendations focused on decisions instead of classifications", () => {
		const markup = renderToStaticMarkup(<EventExplorer events={[activity]} />);

		expect(markup).not.toContain("Klasactiviteit met bronnen");
		expect(markup).not.toContain('aria-label="Onderwerpen"');
		expect(markup).not.toContain('id="event-profile"');
	});

	it("offers a way to reveal matches beyond the bounded initial list", () => {
		const catalog = [
			...Array.from({ length: 4 }, (_, index) => ({
				...activity,
				slug: `activity-${index}`,
				title: `Activiteit ${index}`,
			})),
			{
				...activity,
				slug: "background-story",
				title: "Achtergrond",
				activity: undefined,
			},
		];

		const markup = renderToStaticMarkup(<EventExplorer events={catalog} />);

		expect(markup).toContain(">Toon alle 5 resultaten</button>");
		expect(markup).not.toContain('href="/events/background-story"');
	});

	it("gives an empty catalog a status and creation path", () => {
		const markup = renderToStaticMarkup(<EventExplorer events={[]} />);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('href="/admin"');
		expect(markup).not.toContain("Infinity");
	});
});
