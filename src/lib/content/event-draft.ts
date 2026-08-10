import { z } from "zod";
import { eventFrontmatterSchema } from "./event";
import {
	type Event,
	isEventSlug,
	serializeEventDocument,
} from "./event-document";

const eventDraftSchema = eventFrontmatterSchema.extend({
	slug: z.string().refine(isEventSlug, "Gebruik een geldige bestands-slug"),
	body: z.string().trim().min(1),
});

export type EventDraft = z.infer<typeof eventDraftSchema>;

export type EventDraftPreview = {
	path: string;
	markdown: string;
};

export function parseEventDraft(value: unknown): EventDraft {
	return eventDraftSchema.parse(value);
}

export function createEventDraftPreview(value: unknown): EventDraftPreview {
	const event: Event = parseEventDraft(value);
	return {
		path: `content/events/${event.slug}.md`,
		markdown: serializeEventDocument(event),
	};
}
