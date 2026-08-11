import { describe, expect, it } from "vitest";
import { parseEventFrontmatter } from "../src/lib/content/event";
import {
	parseEventDocument,
	serializeEventDocument,
} from "../src/lib/content/event-document";
import {
	beatSources,
	contextDecisionBeat,
	invalidBeatIdentityCases,
	invalidBeatRouteCases,
	invalidBeatStructuralCases,
	sourceDuelBeat,
	voteRevoteBeat,
} from "./fixtures/interactive-beat";

const voteRevoteBeatV2 = {
	...voteRevoteBeat,
	version: 2,
	responseMethod: "response-cards",
	vocationalConnection:
		"Vergelijk de beslissing met hedendaagse veiligheidsprocedures.",
} as const;

const baseFrontmatter = {
	title: "Testgebeurtenis",
	date: { year: 1969, era: "ce", precision: "year" },
	summary: "Een gebeurtenis om het beatcontract te testen.",
	topics: ["wetenschap"],
	profiles: ["algemeen"],
	sources: beatSources,
};

describe("interactive beat frontmatter", () => {
	it("accepts a versioned vote-revote beat", () => {
		expect(
			parseEventFrontmatter({ ...baseFrontmatter, beat: voteRevoteBeat }),
		).toMatchObject({ beat: voteRevoteBeat });
	});

	it("accepts and serializes a version 2 beat while retaining version 1", () => {
		const event = {
			...parseEventFrontmatter({
				...baseFrontmatter,
				beat: voteRevoteBeatV2,
			}),
			slug: "testgebeurtenis-1969",
			body: "Testverhaal.",
		};
		const document = serializeEventDocument(event);

		expect(parseEventDocument(event.slug, document).beat).toEqual(
			voteRevoteBeatV2,
		);
		expect(
			parseEventFrontmatter({ ...baseFrontmatter, beat: voteRevoteBeat }).beat,
		).toEqual(voteRevoteBeat);
	});

	it.each([
		["source duel", sourceDuelBeat],
		["context-bound decision", contextDecisionBeat],
	])("accepts a versioned %s beat", (_name, beat) => {
		expect(parseEventFrontmatter({ ...baseFrontmatter, beat })).toMatchObject({
			beat,
		});
	});

	it.each(invalidBeatIdentityCases)("rejects %s", (_name, beat) => {
		expect(() => parseEventFrontmatter({ ...baseFrontmatter, beat })).toThrow();
	});

	it("rejects duplicate event source URLs for a beat", () => {
		expect(() =>
			parseEventFrontmatter({
				...baseFrontmatter,
				sources: [
					...beatSources,
					{ ...beatSources[0], title: "Duplicate mission report" },
				],
				beat: voteRevoteBeat,
			}),
		).toThrow();
	});

	it.each(invalidBeatRouteCases)("rejects %s", (_name, beat) => {
		expect(() => parseEventFrontmatter({ ...baseFrontmatter, beat })).toThrow();
	});

	it.each(invalidBeatStructuralCases)("rejects %s", (_name, beat) => {
		expect(() => parseEventFrontmatter({ ...baseFrontmatter, beat })).toThrow();
	});

	it("keeps version fields strict across both beat versions", () => {
		const { responseMethod: _responseMethod, ...missingResponseMethod } =
			voteRevoteBeatV2;
		expect(() =>
			parseEventFrontmatter({
				...baseFrontmatter,
				beat: missingResponseMethod,
			}),
		).toThrow();
		expect(() =>
			parseEventFrontmatter({
				...baseFrontmatter,
				beat: { ...voteRevoteBeat, responseMethod: "response-cards" },
			}),
		).toThrow();
	});

	it.each([
		["unknown response method", { ...voteRevoteBeatV2, responseMethod: "app" }],
		[
			"long vocational connection",
			{ ...voteRevoteBeatV2, vocationalConnection: "x".repeat(241) },
		],
		["unknown version 2 field", { ...voteRevoteBeatV2, autoplay: true }],
	])("rejects version 2 with %s", (_name, beat) => {
		expect(() => parseEventFrontmatter({ ...baseFrontmatter, beat })).toThrow();
	});

	it("preserves a beat through deterministic Markdown serialization", () => {
		const event = {
			...parseEventFrontmatter({
				...baseFrontmatter,
				beat: voteRevoteBeat,
			}),
			slug: "testgebeurtenis-1969",
			body: "Testverhaal.",
		};

		const document = serializeEventDocument(event);
		const reparsed = parseEventDocument(event.slug, document);

		expect(reparsed.beat).toEqual(voteRevoteBeat);
		expect(serializeEventDocument(reparsed)).toBe(document);
	});
});
