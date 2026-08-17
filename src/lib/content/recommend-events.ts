import type { HistoricalDate } from "./event";
import type { EventCatalogEntry } from "./event-catalog";

const dayMilliseconds = 24 * 60 * 60 * 1000;
const referenceYear = 2000;
const referenceYearDays = 366;
const recommendationLimit = 4;

export type RecommendationPreferences = {
	selectedDate: string;
	yearMin: number;
	yearMax: number;
	topics: string[];
	query: string;
};

export type RankedEvent = {
	event: EventCatalogEntry;
	score: number;
	distanceDays: number;
};

export type RecommendationResult = {
	events: RankedEvent[];
	additionalEvents: RankedEvent[];
	periodFallback: boolean;
	totalCount: number;
};

export type RecommendationPage = {
	events: RankedEvent[];
	periodFallback: boolean;
	totalCount: number;
};

export type RecommendationEngine = {
	recommend: (preferences: RecommendationPreferences) => RecommendationResult;
	page: (
		preferences: RecommendationPreferences,
		options: { offset: number; limit: number },
	) => RecommendationPage;
};

export function createRecommendationEngine(
	events: EventCatalogEntry[],
): RecommendationEngine {
	const index = events.map((event) => ({
		event,
		searchableText: createSearchableText(event),
		signedYear: signedYear(event.date),
	}));

	function rank(preferences: RecommendationPreferences) {
		const queryTerms = normalizeSearchValue(preferences.query)
			.split(" ")
			.filter(Boolean);
		const searchedEvents = index.filter(({ searchableText }) =>
			queryTerms.every((term) => searchableText.includes(term)),
		);
		const periodEvents = searchedEvents.filter(
			({ signedYear: year }) =>
				year >= preferences.yearMin && year <= preferences.yearMax,
		);
		const periodFallback =
			periodEvents.length === 0 && searchedEvents.length > 0;
		const candidates = periodFallback ? searchedEvents : periodEvents;
		const selectedWeekDays = createSelectedWeekDays(preferences.selectedDate);
		const rankedEvents = candidates
			.map(({ event }) => {
				const distanceDays = distanceToSelectedWeek(
					event.date,
					selectedWeekDays,
				);
				const activityPriority = event.activity ? 100 : 0;
				const proximity = Math.max(0, 35 - distanceDays * 3);
				const topicMatches = preferences.topics.filter((topic) =>
					event.topics.includes(topic),
				).length;
				return {
					event,
					distanceDays,
					score: activityPriority + proximity + topicMatches * 4,
				};
			})
			.sort(compareRankedEvents);
		return { periodFallback, rankedEvents };
	}

	return {
		recommend: (preferences) => {
			const { periodFallback, rankedEvents } = rank(preferences);
			return {
				events: rankedEvents.slice(0, recommendationLimit),
				additionalEvents: rankedEvents.slice(recommendationLimit),
				periodFallback,
				totalCount: rankedEvents.length,
			};
		},
		page: (preferences, { offset, limit }) => {
			assertPage(offset, limit);
			const { periodFallback, rankedEvents } = rank(preferences);
			return {
				events: rankedEvents.slice(offset, offset + limit),
				periodFallback,
				totalCount: rankedEvents.length,
			};
		},
	};
}

export function recommendEvents(
	events: EventCatalogEntry[],
	preferences: RecommendationPreferences,
): RecommendationResult {
	return createRecommendationEngine(events).recommend(preferences);
}

export function recommendEventPage(
	events: EventCatalogEntry[],
	preferences: RecommendationPreferences,
	options: { offset: number; limit: number },
): RecommendationPage {
	return createRecommendationEngine(events).page(preferences, options);
}

function assertPage(offset: number, limit: number) {
	if (!Number.isSafeInteger(offset) || offset < 0) {
		throw new Error("Recommendation offset must be a non-negative integer");
	}
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 24) {
		throw new Error("Recommendation page limit must be at most 24");
	}
}

function createSearchableText(event: EventCatalogEntry): string {
	return [
		event.title,
		event.summary,
		...event.topics,
		...Object.values(event.topicLabels ?? {}),
		event.activity?.question ?? "",
	]
		.map(normalizeSearchValue)
		.join(" ");
}

function normalizeSearchValue(value: string): string {
	return value
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase("nl-BE")
		.replaceAll(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function signedYear(date: HistoricalDate): number {
	return date.era === "bce" ? -date.year : date.year;
}

function createSelectedWeekDays(selectedDate: string): number[] {
	const selected = parseISODate(selectedDate);
	const daysSinceMonday = (selected.getUTCDay() + 6) % 7;
	const weekStart = new Date(
		selected.getTime() - daysSinceMonday * dayMilliseconds,
	);
	return Array.from({ length: 7 }, (_, offset) => {
		const current = new Date(weekStart.getTime() + offset * dayMilliseconds);
		return referenceDay(current.getUTCMonth() + 1, current.getUTCDate());
	});
}

function distanceToSelectedWeek(
	date: HistoricalDate,
	selectedWeekDays: number[],
): number {
	if (date.precision === "year" || date.precision === "approximate") {
		return referenceYearDays;
	}
	const eventDay = referenceDay(
		date.month,
		date.precision === "day" ? date.day : 15,
	);
	let closest = referenceYearDays;
	for (const weekDay of selectedWeekDays) {
		const directDistance = Math.abs(eventDay - weekDay);
		closest = Math.min(
			closest,
			directDistance,
			referenceYearDays - directDistance,
		);
	}
	return closest;
}

function referenceDay(month: number, day: number): number {
	return Math.round(
		(Date.UTC(referenceYear, month - 1, day) - Date.UTC(referenceYear, 0, 1)) /
			dayMilliseconds,
	);
}

function parseISODate(value: string): Date {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`Invalid selected date: ${value}`);
	}
	const date = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid selected date: ${value}`);
	}
	return date;
}

function compareRankedEvents(left: RankedEvent, right: RankedEvent): number {
	if (right.score !== left.score) return right.score - left.score;
	if (left.distanceDays !== right.distanceDays) {
		return left.distanceDays - right.distanceDays;
	}
	if (left.event.slug < right.event.slug) return -1;
	if (left.event.slug > right.event.slug) return 1;
	return 0;
}
