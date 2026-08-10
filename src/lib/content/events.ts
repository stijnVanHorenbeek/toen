import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type Event, isEventSlug, parseEventDocument } from "./event-document";

const eventsDirectory = path.join(process.cwd(), "content", "events");

export async function getAllEvents(): Promise<Event[]> {
	const filenames = (await readdir(eventsDirectory))
		.filter((filename) => filename.endsWith(".md"))
		.sort();

	return Promise.all(
		filenames.map((filename) =>
			readEventFile(filename.slice(0, -".md".length)),
		),
	);
}

export async function getEventBySlug(slug: string): Promise<Event | null> {
	if (!isEventSlug(slug)) {
		return null;
	}

	try {
		return await readEventFile(slug);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

async function readEventFile(slug: string): Promise<Event> {
	const document = await readFile(
		path.join(eventsDirectory, `${slug}.md`),
		"utf8",
	);

	return parseEventDocument(slug, document);
}
