import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EventArticle } from "../src/app/_components/event-article";

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

it("renders the same public event content in page and preview variants", () => {
	const page = renderToStaticMarkup(
		<EventArticle event={event} variant="page" />,
	);
	const preview = renderToStaticMarkup(
		<EventArticle event={event} variant="preview" />,
	);
	for (const content of [
		"november 1918",
		"Test",
		"Samenvatting",
		"Verhaal met",
		"Belgische geschiedenis",
		"Bron",
		"Uitgever",
	]) {
		expect(page).toContain(content);
		expect(preview).toContain(content);
	}
	expect(page).toContain('data-event-article="page"');
	expect(page).toContain("<h1");
	expect(page).toContain("<h2");
	expect(preview).toContain('data-event-article="preview"');
	expect(preview).toContain("<h2");
	expect(preview).toContain("<h3");
});

it("styles every supported Markdown block in public prose", () => {
	const css = readFileSync("src/app/globals.css", "utf8");
	for (const selector of [
		".prose-event h3",
		".prose-event ul",
		".prose-event ol",
		".prose-event blockquote",
	]) {
		expect(css).toContain(selector);
	}
	expect(css).toContain("list-style: disc");
	expect(css).toContain("list-style: decimal");
});
