import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAllEvents } from "../src/lib/content/events";
import { inspectStaticPublicSite } from "../src/lib/content/static-site";

async function main() {
	const appRoot = process.cwd();
	const outputDirectory = path.join(appRoot, ".generated", "static-site");
	const inspection = await inspectStaticPublicSite(outputDirectory);
	const manifest = JSON.parse(
		await readFile(
			path.join(appRoot, ".generated", "static-site.json"),
			"utf8",
		),
	) as Record<string, unknown>;
	if (
		manifest.schemaVersion !== 1 ||
		manifest.fileCount !== inspection.fileCount ||
		manifest.htmlFileCount !== inspection.htmlFileCount ||
		!Array.isArray(manifest.paths) ||
		manifest.paths.length !== inspection.paths.length ||
		manifest.paths.some((entry, index) => entry !== inspection.paths[index])
	) {
		throw new Error("Static site output does not match build manifest");
	}
	if (!inspection.paths.includes("admin.html")) {
		throw new Error("Static site is missing admin.html");
	}
	const events = await getAllEvents();
	for (const event of events) {
		for (const expected of [
			`events/${event.slug}.html`,
			`events/${event.slug}/play.html`,
		]) {
			if (!inspection.paths.includes(expected)) {
				throw new Error(`Static site is missing ${expected}`);
			}
		}
	}
	const forbidden = inspection.paths.find(
		(entry) =>
			entry.endsWith(".md") ||
			entry.endsWith(".rsc") ||
			entry.endsWith(".map") ||
			entry.includes("__next"),
	);
	if (forbidden) {
		throw new Error(
			`Static site contains forbidden runtime artifact: ${forbidden}`,
		);
	}
	console.log(
		JSON.stringify({
			event: "static-site-checked",
			eventCount: events.length,
			fileCount: inspection.fileCount,
			htmlFileCount: inspection.htmlFileCount,
		}),
	);
}

void main();
