import { compareLocalized, formatEventTag } from "../i18n/locale";
import { collectTopicLabels, type EventCatalogEntry } from "./event-catalog";

const maximumPeriodArchives = 24;
const maximumTopicArchives = 256;

export type PeriodArchive = {
	id: string;
	minimumYear: number;
	maximumYear: number;
	events: EventCatalogEntry[];
};

export type TopicArchive = {
	id: string;
	label: string;
	events: EventCatalogEntry[];
};

export function createPeriodArchives(
	events: EventCatalogEntry[],
): PeriodArchive[] {
	if (events.length === 0) return [];
	const years = events.map(signedYear);
	const minimumYear = Math.min(...years);
	const maximumYear = Math.max(...years);
	const span = maximumYear - minimumYear + 1;
	const bucketCount = Math.min(maximumPeriodArchives, span);
	const bucketWidth = Math.ceil(span / bucketCount);
	const archives: PeriodArchive[] = [];
	for (let index = 0; index < bucketCount; index += 1) {
		const minimum = minimumYear + index * bucketWidth;
		if (minimum > maximumYear) break;
		const maximum = Math.min(maximumYear, minimum + bucketWidth - 1);
		const matching = sortEvents(
			events.filter((event) => {
				const year = signedYear(event);
				return year >= minimum && year <= maximum;
			}),
		);
		if (matching.length === 0) continue;
		archives.push({
			id: String(index + 1).padStart(2, "0"),
			minimumYear: minimum,
			maximumYear: maximum,
			events: matching,
		});
	}
	return archives;
}

export function createTopicArchives(
	events: EventCatalogEntry[],
): TopicArchive[] {
	const topicIds = [...new Set(events.flatMap((event) => event.topics))].sort(
		compareLocalized,
	);
	if (topicIds.length > maximumTopicArchives) {
		throw new Error(
			`Static archives support at most ${maximumTopicArchives} topics`,
		);
	}
	const labels = collectTopicLabels(events);
	return topicIds.map((id) => ({
		id,
		label: labels[id] ?? formatEventTag(id),
		events: sortEvents(events.filter((event) => event.topics.includes(id))),
	}));
}

function sortEvents(events: EventCatalogEntry[]): EventCatalogEntry[] {
	return [...events].sort((left, right) => {
		const yearDifference = signedYear(left) - signedYear(right);
		if (yearDifference !== 0) return yearDifference;
		if (left.slug < right.slug) return -1;
		if (left.slug > right.slug) return 1;
		return 0;
	});
}

function signedYear(event: EventCatalogEntry): number {
	return event.date.era === "bce" ? -event.date.year : event.date.year;
}
