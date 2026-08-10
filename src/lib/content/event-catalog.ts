import type { Event } from "./event-document";

export type EventCatalogEntry = Pick<
	Event,
	"slug" | "title" | "date" | "summary" | "topics" | "profiles"
>;

export function toEventCatalogEntry(event: Event): EventCatalogEntry {
	return {
		slug: event.slug,
		title: event.title,
		date: event.date,
		summary: event.summary,
		topics: event.topics,
		profiles: event.profiles,
	};
}
