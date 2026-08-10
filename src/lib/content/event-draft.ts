import { z } from "zod";
import { messages } from "../i18n/messages.nl-BE";
import { isSupportedEditorMarkdown } from "./editor-markdown";
import { eventFrontmatterSchema, validateSelectedTopicLabels } from "./event";
import {
	type Event,
	isEventSlug,
	serializeEventDocument,
} from "./event-document";

const eventDraftSchema = z
	.object({
		...eventFrontmatterSchema.shape,
		body: z
			.string()
			.trim()
			.min(1)
			.refine(isSupportedEditorMarkdown, messages.errors.bodyFormat),
	})
	.superRefine(validateSelectedTopicLabels)
	.transform((draft) => ({
		...draft,
		slug: inferEventSlug(draft.title, draft.date),
	}))
	.refine((draft) => isEventSlug(draft.slug), {
		path: ["title"],
		message: messages.errors.titleAddress,
	});

export type EventDraft = z.infer<typeof eventDraftSchema>;

export type EventDraftPreview = {
	event: Event;
	path: string;
	markdown: string;
};

export function inferEventSlug(
	title: string,
	date: { year: number; era: "ce" | "bce" },
): string {
	const titlePart = title
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	const eraPart = date.era === "bce" ? "-bce" : "";
	return `${titlePart}-${date.year}${eraPart}`;
}

export function parseEventDraft(value: unknown): EventDraft {
	return eventDraftSchema.parse(value);
}

export function createEventDraftPreview(value: unknown): EventDraftPreview {
	const event: Event = parseEventDraft(value);
	return {
		event,
		path: `content/events/${event.slug}.md`,
		markdown: serializeEventDocument(event),
	};
}
