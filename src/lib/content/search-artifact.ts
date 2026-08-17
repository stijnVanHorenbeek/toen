import { formatEventTag } from "../i18n/locale";
import type { HistoricalDate } from "./event";
import { collectTopicLabels, type EventCatalogEntry } from "./event-catalog";

export const EVENT_SEARCH_SCHEMA_VERSION = 1;
export const EVENT_SEARCH_MAX_EVENTS = 10_000;
export const EVENT_SEARCH_MAX_BYTES = Math.floor(2.5 * 1024 ** 2);
const releaseIdPattern = /^[0-9a-f]{64}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const mechanics = new Set(["vote-revote", "source-duel", "context-decision"]);

export type EventSearchEntry = Omit<EventCatalogEntry, "topicLabels">;

export type EventSearchArtifact = {
	schemaVersion: 1;
	releaseId: string;
	topicLabels: Record<string, string>;
	events: EventSearchEntry[];
};

export function createEventSearchArtifact(
	events: EventCatalogEntry[],
	{
		releaseId,
		topicLabels = createCompleteTopicLabels(events),
	}: { releaseId: string; topicLabels?: Record<string, string> },
): EventSearchArtifact {
	return parseEventSearchArtifact({
		schemaVersion: EVENT_SEARCH_SCHEMA_VERSION,
		releaseId,
		topicLabels,
		events: events.map((event) => ({
			slug: event.slug,
			title: event.title,
			date: event.date,
			summary: event.summary,
			topics: event.topics,
			...(event.activity ? { activity: event.activity } : {}),
		})),
	});
}

export function parseEventSearchArtifact(
	value: unknown,
	{ expectedReleaseId }: { expectedReleaseId?: string } = {},
): EventSearchArtifact {
	const artifact = requireRecord(value, "Search artifact");
	if (artifact.schemaVersion !== EVENT_SEARCH_SCHEMA_VERSION) {
		throw new Error("Unsupported event search schema version");
	}
	const releaseId = requireString(artifact.releaseId, "releaseId", 64);
	if (!releaseIdPattern.test(releaseId)) {
		throw new Error(
			"Search artifact releaseId must be 64 lowercase hex characters",
		);
	}
	if (expectedReleaseId && releaseId !== expectedReleaseId) {
		throw new Error("Search artifact releaseId does not match request path");
	}
	const topicLabels = parseTopicLabels(artifact.topicLabels);
	if (!Array.isArray(artifact.events)) {
		throw new Error("Search artifact events must be an array");
	}
	if (artifact.events.length > EVENT_SEARCH_MAX_EVENTS) {
		throw new Error(
			`Search artifact supports at most ${EVENT_SEARCH_MAX_EVENTS} events`,
		);
	}
	const seenSlugs = new Set<string>();
	const events = artifact.events.map((entry, index) => {
		const event = parseSearchEvent(entry, index, topicLabels);
		if (seenSlugs.has(event.slug)) {
			throw new Error(`Search artifact contains duplicate slug ${event.slug}`);
		}
		seenSlugs.add(event.slug);
		return event;
	});
	return {
		schemaVersion: EVENT_SEARCH_SCHEMA_VERSION,
		releaseId,
		topicLabels,
		events,
	};
}

export function hydrateEventSearchEntries(
	artifact: EventSearchArtifact,
): EventCatalogEntry[] {
	return artifact.events.map((event) => ({
		...event,
		...(event.topics.length > 0
			? {
					topicLabels: Object.fromEntries(
						event.topics.map((topic) => [topic, artifact.topicLabels[topic]]),
					),
				}
			: {}),
	}));
}

function createCompleteTopicLabels(
	events: EventCatalogEntry[],
): Record<string, string> {
	const explicit = collectTopicLabels(events);
	return Object.fromEntries(
		[...new Set(events.flatMap((event) => event.topics))].map((topic) => [
			topic,
			explicit[topic] ?? formatEventTag(topic),
		]),
	);
}

function parseSearchEvent(
	value: unknown,
	index: number,
	topicLabels: Record<string, string>,
): EventSearchEntry {
	const event = requireRecord(value, `events[${index}]`);
	const slug = requireString(event.slug, `events[${index}].slug`, 120);
	if (!slugPattern.test(slug)) {
		throw new Error(`Invalid event slug at events[${index}]`);
	}
	const topics = requireStringArray(event.topics, `events[${index}].topics`, {
		maximumItems: 16,
		maximumLength: 80,
	});
	for (const topic of topics) {
		if (!Object.hasOwn(topicLabels, topic)) {
			throw new Error(`Missing topic label for ${topic}`);
		}
	}
	return {
		slug,
		title: requireString(event.title, `events[${index}].title`, 160),
		date: parseHistoricalDate(event.date, `events[${index}].date`),
		summary: requireString(event.summary, `events[${index}].summary`, 500),
		topics,
		...(event.activity === undefined
			? {}
			: {
					activity: parseActivity(event.activity, `events[${index}].activity`),
				}),
	};
}

function parseActivity(value: unknown, label: string) {
	const activity = requireRecord(value, label);
	const mechanic = requireString(activity.mechanic, `${label}.mechanic`, 32);
	if (!mechanics.has(mechanic)) {
		throw new Error(`Unsupported mechanic at ${label}.mechanic`);
	}
	if (!Array.isArray(activity.durations) || activity.durations.length > 3) {
		throw new Error(`${label}.durations must contain at most 3 values`);
	}
	const durations = activity.durations.map((duration) => {
		if (duration !== 5 && duration !== 8 && duration !== 12) {
			throw new Error(`Unsupported duration at ${label}.durations`);
		}
		return duration;
	});
	return {
		mechanic: mechanic as "vote-revote" | "source-duel" | "context-decision",
		question: requireString(activity.question, `${label}.question`, 500),
		durations,
	};
}

function parseTopicLabels(value: unknown): Record<string, string> {
	const labels = requireRecord(value, "topicLabels");
	const entries = Object.entries(labels);
	if (entries.length > 256) {
		throw new Error("Search artifact supports at most 256 topic labels");
	}
	return Object.fromEntries(
		entries.map(([id, label]) => [
			requireString(id, "topicLabels key", 80),
			requireString(label, `topicLabels.${id}`, 160),
		]),
	);
}

function parseHistoricalDate(value: unknown, label: string): HistoricalDate {
	const date = requireRecord(value, label);
	const year = requireInteger(date.year, `${label}.year`, 1, 9999);
	if (date.era !== "bce" && date.era !== "ce") {
		throw new Error(`${label}.era must be bce or ce`);
	}
	if (date.precision === "year" || date.precision === "approximate") {
		return { year, era: date.era, precision: date.precision };
	}
	const month = requireInteger(date.month, `${label}.month`, 1, 12);
	if (date.precision === "month") {
		return { year, era: date.era, precision: "month", month };
	}
	if (date.precision === "day") {
		const day = requireInteger(date.day, `${label}.day`, 1, 31);
		const calendarDate = new Date(Date.UTC(2000, month - 1, day));
		if (
			calendarDate.getUTCMonth() !== month - 1 ||
			calendarDate.getUTCDate() !== day
		) {
			throw new Error(`${label} contains an invalid calendar day`);
		}
		return {
			year,
			era: date.era,
			precision: "day",
			month,
			day,
		};
	}
	throw new Error(`${label}.precision is unsupported`);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string, maximum: number): string {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > maximum
	) {
		throw new Error(`${label} must be between 1 and ${maximum} characters`);
	}
	return value;
}

function requireStringArray(
	value: unknown,
	label: string,
	{
		maximumItems,
		maximumLength,
	}: { maximumItems: number; maximumLength: number },
): string[] {
	if (!Array.isArray(value) || value.length > maximumItems) {
		throw new Error(`${label} must contain at most ${maximumItems} values`);
	}
	const values = value.map((entry, index) =>
		requireString(entry, `${label}[${index}]`, maximumLength),
	);
	if (new Set(values).size !== values.length) {
		throw new Error(`${label} must not contain duplicates`);
	}
	return values;
}

function requireInteger(
	value: unknown,
	label: string,
	minimum: number,
	maximum: number,
): number {
	if (
		!Number.isSafeInteger(value) ||
		(value as number) < minimum ||
		(value as number) > maximum
	) {
		throw new Error(`${label} must be between ${minimum} and ${maximum}`);
	}
	return value as number;
}
