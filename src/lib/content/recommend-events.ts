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

export function recommendEvents(
	events: EventCatalogEntry[],
	preferences: RecommendationPreferences,
): RecommendationResult {
	const searchedEvents = events.filter((event) =>
		matchesQuery(event, preferences.query),
	);
	const periodEvents = searchedEvents.filter(({ date }) => {
		const year = signedYear(date);
		return year >= preferences.yearMin && year <= preferences.yearMax;
	});
	const periodFallback = periodEvents.length === 0 && searchedEvents.length > 0;
	const candidates = periodFallback ? searchedEvents : periodEvents;

	const rankedEvents = candidates
		.map((event) => {
			const distanceDays = distanceToSelectedWeek(
				event.date,
				preferences.selectedDate,
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
		.sort((left, right) => {
			if (right.score !== left.score) return right.score - left.score;
			if (left.distanceDays !== right.distanceDays) {
				return left.distanceDays - right.distanceDays;
			}
			return left.event.slug.localeCompare(right.event.slug);
		});

	return {
		events: rankedEvents.slice(0, recommendationLimit),
		additionalEvents: rankedEvents.slice(recommendationLimit),
		periodFallback,
		totalCount: rankedEvents.length,
	};
}

function matchesQuery(event: EventCatalogEntry, query: string): boolean {
	const queryTerms = normalizeSearchValue(query).split(" ").filter(Boolean);
	if (queryTerms.length === 0) return true;

	const searchableValues = [
		event.title,
		event.summary,
		...event.topics,
		...Object.values(event.topicLabels ?? {}),
		event.activity?.question ?? "",
	];
	const searchableText = searchableValues.map(normalizeSearchValue).join(" ");
	return queryTerms.every((term) => searchableText.includes(term));
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

function distanceToSelectedWeek(
	date: HistoricalDate,
	selectedDate: string,
): number {
	if (date.precision === "year" || date.precision === "approximate") {
		return referenceYearDays;
	}

	const eventDay = referenceDay(
		date.month,
		date.precision === "day" ? date.day : 15,
	);
	const selected = parseISODate(selectedDate);
	const daysSinceMonday = (selected.getUTCDay() + 6) % 7;
	const weekStart = new Date(
		selected.getTime() - daysSinceMonday * dayMilliseconds,
	);
	let closest = referenceYearDays;

	for (let offset = 0; offset < 7; offset += 1) {
		const current = new Date(weekStart.getTime() + offset * dayMilliseconds);
		const weekDay = referenceDay(
			current.getUTCMonth() + 1,
			current.getUTCDate(),
		);
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
