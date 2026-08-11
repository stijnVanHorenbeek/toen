import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EventArticle } from "../src/app/_components/event-article";
import { interactiveBeatSchema } from "../src/lib/content/event";
import { beatSources, voteRevoteBeat } from "./fixtures/interactive-beat";

const event = {
	slug: "test-1918",
	title: "Test",
	date: {
		year: 1918,
		era: "ce" as const,
		precision: "month" as const,
		month: 11,
	},
	summary: "Samenvatting",
	body: "Verhaal met **nadruk**.",
	topics: ["belgie"],
	topicLabels: { belgie: "Belgische geschiedenis" },
	profiles: ["algemeen" as const],
	sources: [
		{ title: "Bron", publisher: "Uitgever", url: "https://example.org" },
	],
};

it("renders event content with page and preview heading hierarchies", () => {
	const page = renderToStaticMarkup(
		<EventArticle event={event} variant="page" />,
	);
	const preview = renderToStaticMarkup(
		<EventArticle event={event} variant="preview" />,
	);
	for (const content of [
		"november 1918",
		"Samenvatting",
		"Verhaal met",
		"Belgische geschiedenis",
		"Bron",
		"Uitgever",
	]) {
		expect(page).toContain(content);
		expect(preview).toContain(content);
	}
	expect(page).toMatch(/<h1[^>]*>Test<\/h1>/);
	expect(preview).toMatch(/<h2[^>]*>Test<\/h2>/);
	expect(
		[...page.matchAll(/<h([1-6])[^>]*>/g)].map(([, level]) => level),
	).toEqual(["1", "2"]);
	expect(
		[...preview.matchAll(/<h([1-6])[^>]*>/g)].map(([, level]) => level),
	).toEqual(["2", "3"]);
});

it("links runnable public events to their classroom beat", () => {
	const runnableEvent = {
		...event,
		sources: beatSources.map((source) => ({ ...source })),
		beat: interactiveBeatSchema.parse(voteRevoteBeat),
	};
	const page = renderToStaticMarkup(
		<EventArticle event={runnableEvent} variant="page" />,
	);
	const preview = renderToStaticMarkup(
		<EventArticle event={runnableEvent} variant="preview" />,
	);

	expect(page).toContain('href="/events/test-1918/play"');
	expect(preview).not.toContain("/events/test-1918/play");
});
