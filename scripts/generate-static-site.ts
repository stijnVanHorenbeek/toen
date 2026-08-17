import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAllEvents } from "../src/lib/content/events";
import { generateStaticPublicSite } from "../src/lib/content/static-site";

async function main() {
	const appRoot = process.cwd();
	const discovery = requireDiscovery(
		JSON.parse(
			await readFile(
				path.join(appRoot, ".generated", "discovery.json"),
				"utf8",
			),
		),
		JSON.parse(
			await readFile(
				path.join(appRoot, ".generated", "browser-assets.json"),
				"utf8",
			),
		),
	);
	const outputDirectory = path.join(appRoot, ".generated", "static-site");
	const result = await generateStaticPublicSite({
		discovery,
		events: await getAllEvents(),
		nextStaticDirectory: path.join(appRoot, ".next", "static"),
		origin:
			process.env.TOEN_PUBLIC_ORIGIN ?? "https://toen.stijnvh.workers.dev",
		outputDirectory,
		publicDirectory: path.join(appRoot, "public"),
	});
	const manifest = {
		schemaVersion: 1,
		...result,
	};
	const manifestPath = path.join(appRoot, ".generated", "static-site.json");
	const temporaryPath = `${manifestPath}.tmp-${randomUUID()}`;
	try {
		await writeFile(temporaryPath, `${JSON.stringify(manifest)}\n`, {
			flag: "wx",
		});
		await rename(temporaryPath, manifestPath);
	} finally {
		await rm(temporaryPath, { force: true });
	}
	console.log(JSON.stringify({ event: "static-site-generated", ...result }));
}

void main();

function requireDiscovery(value: unknown, browserValue: unknown) {
	if (
		!value ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		!browserValue ||
		typeof browserValue !== "object" ||
		Array.isArray(browserValue)
	) {
		throw new Error("Generated discovery pointer is invalid");
	}
	const record = value as Record<string, unknown>;
	const browser = browserValue as Record<string, unknown>;
	if (
		typeof record.releaseId !== "string" ||
		!/^[0-9a-f]{64}$/.test(record.releaseId) ||
		typeof record.searchIndexUrl !== "string" ||
		typeof browser.eventSearchWorkerUrl !== "string"
	) {
		throw new Error("Generated discovery pointer is invalid");
	}
	return {
		releaseId: record.releaseId,
		searchIndexUrl: record.searchIndexUrl,
		workerUrl: browser.eventSearchWorkerUrl,
	};
}
