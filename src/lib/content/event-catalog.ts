import type { InteractiveBeat } from "./event";
import type { Event } from "./event-document";

export type EventCatalogActivity = Pick<
	InteractiveBeat,
	"mechanic" | "question"
> & {
	durations: Array<5 | 8 | 12>;
};

export type EventCatalogEntry = Pick<
	Event,
	"slug" | "title" | "date" | "summary" | "topics" | "topicLabels"
> & {
	activity?: EventCatalogActivity;
};

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
		...(event.beat
			? {
					activity: {
						mechanic: event.beat.mechanic,
						question: event.beat.question,
						durations: event.beat.routes.map(
							({ durationMinutes }) => durationMinutes,
						),
					},
				}
			: {}),
	};
}
