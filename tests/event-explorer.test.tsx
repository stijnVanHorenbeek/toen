import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventExplorer } from "../src/app/_components/event-explorer/event-explorer";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";
import { createEventExplorerBootstrap } from "../src/lib/content/event-explorer-data";
import { getRecommendationPagination } from "../src/lib/content/recommendation-pagination";

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
const releaseId = "a".repeat(64);
const workerUrl = `/workers/event-search-${"b".repeat(20)}.js`;

function explorer(events: EventCatalogEntry[]) {
	return (
		<EventExplorer
			bootstrap={createEventExplorerBootstrap(events, { releaseId, workerUrl })}
		/>
	);
}

describe("EventExplorer", () => {
	it("uses curated imagery to make recommendations visually distinct", () => {
		const markup = renderToStaticMarkup(
			explorer([{ ...activity, slug: "apollo-11-1969" }]),
		);

		expect(markup).toContain(
			'src="/media/assets/2d514da09e22846759e1552189646ee456a973fa641399599875dc10bae7c5cb.webp"',
		);
		expect(markup).toContain('alt="Buzz Aldrin staat op het maanoppervlak');
	});

	it("offers classroom launch and background reading for runnable events", () => {
		const markup = renderToStaticMarkup(explorer([activity]));

		expect(markup).toContain('href="/events/test-activity/play"');
		expect(markup).toContain('href="/events/test-activity"');
	});

	it("keeps recommendations focused on decisions instead of classifications", () => {
		const markup = renderToStaticMarkup(explorer([activity]));

		expect(markup).not.toContain("Klasactiviteit met bronnen");
		expect(markup).not.toContain('aria-label="Onderwerpen"');
		expect(markup).not.toContain('id="event-profile"');
	});

	it("offers bounded expansion without serializing later matches", () => {
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
		const bootstrap = createEventExplorerBootstrap(catalog, {
			releaseId,
			workerUrl,
		});
		const markup = renderToStaticMarkup(
			<EventExplorer bootstrap={bootstrap} />,
		);

		expect(bootstrap.initialRecommendations.events).toHaveLength(4);
		expect(JSON.stringify(bootstrap)).not.toContain("background-story");
		expect(markup).toContain(">Toon alle 5 resultaten</button>");
		expect(markup).not.toContain('href="/events/background-story"');
	});

	it("keeps a 5,000-event bootstrap bounded to four entries", () => {
		const catalog = Array.from({ length: 5_000 }, (_, index) => ({
			...activity,
			slug: `activity-${String(index).padStart(4, "0")}`,
			title: `Activiteit ${index}`,
		}));

		const bootstrap = createEventExplorerBootstrap(catalog, {
			releaseId,
			workerUrl,
		});

		expect(bootstrap.initialRecommendations.events).toHaveLength(4);
		expect(bootstrap.initialRecommendations.totalCount).toBe(5_000);
		expect(Buffer.byteLength(JSON.stringify(bootstrap))).toBeLessThan(10_000);
	});

	it("keeps previous navigation on a one-result final page", () => {
		expect(
			getRecommendationPagination({
				eventCount: 1,
				isInitialPage: false,
				offset: 24,
				pageSize: 24,
				totalCount: 25,
			}),
		).toMatchObject({
			hasPrevious: true,
			hasNext: false,
			showNavigation: true,
		});
	});

	it("gives an empty catalog a status and creation path", () => {
		const markup = renderToStaticMarkup(explorer([]));

		expect(markup).toContain('role="status"');
		expect(markup).toContain('href="/admin"');
		expect(markup).not.toContain("Infinity");
	});
});
