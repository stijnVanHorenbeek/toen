import { parse, stringify } from "yaml";
import { type EventFrontmatter, parseEventFrontmatter } from "./event";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type Event = EventFrontmatter & {
	slug: string;
	body: string;
};

export function isEventSlug(value: string): boolean {
	return slugPattern.test(value);
}

export function parseEventDocument(slug: string, document: string): Event {
	if (!isEventSlug(slug)) {
		throw new Error(`Invalid event slug: ${slug}`);
	}

	const match = frontmatterPattern.exec(document);
	if (!match) {
		throw new Error(`Event document ${slug} has no valid frontmatter block`);
	}

	const frontmatter = parseEventFrontmatter(parse(match[1]));
	const body = match[2].trim();
	if (!body) {
		throw new Error(`Event document ${slug} has no Markdown body`);
	}

	return { ...frontmatter, slug, body };
}

export function serializeEventDocument(event: Event): string {
	const frontmatter: EventFrontmatter = {
		title: event.title,
		date: event.date,
		summary: event.summary,
		topics: event.topics,
		profiles: event.profiles,
		sources: event.sources,
	};
	const yaml = stringify(frontmatter, { lineWidth: 0 }).trimEnd();

	return `---\n${yaml}\n---\n\n${event.body.trim()}\n`;
}
