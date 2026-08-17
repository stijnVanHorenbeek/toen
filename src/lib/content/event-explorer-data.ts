import { compareLocalized, formatEventTag } from "../i18n/locale";
import { collectTopicLabels, type EventCatalogEntry } from "./event-catalog";
import {
	type RecommendationPage,
	type RecommendationPreferences,
	recommendEventPage,
} from "./recommend-events";

export type EventExplorerBootstrap = {
	catalogSize: number;
	releaseId: string;
	searchIndexUrl: string;
	workerUrl: string;
	yearRange: { min: number; max: number };
	topicLabels: Record<string, string>;
	topicOptions: string[];
	initialRecommendations: RecommendationPage;
};

export function createEventExplorerBootstrap(
	events: EventCatalogEntry[],
	{ releaseId, workerUrl }: { releaseId: string; workerUrl: string },
): EventExplorerBootstrap {
	if (!/^[0-9a-f]{64}$/.test(releaseId)) {
		throw new Error(
			"Event explorer release ID must be 64 lowercase hex characters",
		);
	}
	if (!/^\/workers\/event-search-[0-9a-f]{20}\.js$/.test(workerUrl)) {
		throw new Error("Event explorer Worker URL is invalid");
	}
	const yearRange = getYearRange(events);
	const topicOptions = collectTags(events.flatMap((event) => event.topics));
	const explicitLabels = collectTopicLabels(events);
	const topicLabels = Object.fromEntries(
		topicOptions.map((topic) => [
			topic,
			explicitLabels[topic] ?? formatEventTag(topic),
		]),
	);
	const preferences = createDefaultRecommendationPreferences(yearRange);
	const recommendations = recommendEventPage(events, preferences, {
		offset: 0,
		limit: 4,
	});
	return {
		catalogSize: events.length,
		releaseId,
		searchIndexUrl: `/releases/${releaseId}/search.json`,
		workerUrl,
		yearRange,
		topicLabels,
		topicOptions,
		initialRecommendations: {
			events: recommendations.events,
			periodFallback: recommendations.periodFallback,
			totalCount: recommendations.totalCount,
		},
	};
}

export function createDefaultRecommendationPreferences(yearRange: {
	min: number;
	max: number;
}): RecommendationPreferences {
	return {
		selectedDate: "2000-01-03",
		yearMin: yearRange.min,
		yearMax: yearRange.max,
		topics: [],
		query: "",
	};
}

function getYearRange(events: EventCatalogEntry[]) {
	if (events.length === 0) return { min: -3000, max: 2100 };
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;
	for (const event of events) {
		const year = event.date.era === "bce" ? -event.date.year : event.date.year;
		minimum = Math.min(minimum, year);
		maximum = Math.max(maximum, year);
	}
	return { min: minimum, max: maximum };
}

function collectTags(values: string[]): string[] {
	return [...new Set(values)].sort(compareLocalized);
}
