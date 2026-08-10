import type { Event } from "./event-document";

export type EventCatalogEntry = Pick<
	Event,
	"slug" | "title" | "date" | "summary" | "topics" | "topicLabels" | "profiles"
>;

export function collectTopicLabels(
	events: Array<Pick<Event, "topics" | "topicLabels">>,
): Record<string, string> {
	const labels: Record<string, string> = {};
	for (const event of events) {
		for (const topic of event.topics) {
			const label = event.topicLabels?.[topic];
			if (label && !labels[topic]) labels[topic] = label;
		}
	}
	return labels;
}

export function toEventCatalogEntry(event: Event): EventCatalogEntry {
	return {
		slug: event.slug,
		title: event.title,
		date: event.date,
		summary: event.summary,
		topics: event.topics,
		...(event.topicLabels ? { topicLabels: event.topicLabels } : {}),
		profiles: event.profiles,
	};
}
