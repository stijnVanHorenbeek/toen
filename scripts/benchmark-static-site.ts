import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
	type Event,
	parseEventDocument,
} from "../src/lib/content/event-document";
import { generateStaticPublicSite } from "../src/lib/content/static-site";

async function main() {
	const options = parseArguments(process.argv.slice(2));
	const root = await mkdtemp(path.join(tmpdir(), "toen-static-benchmark-"));
	try {
		const outputDirectory = path.join(root, "site");
		const nextStaticDirectory = path.join(root, "next-static");
		const publicDirectory = path.join(root, "public");
		const releaseId = "a".repeat(64);
		const workerName = `event-search-${"b".repeat(20)}.js`;
		await mkdir(path.join(nextStaticDirectory, "chunks"), { recursive: true });
		await mkdir(path.join(nextStaticDirectory, "media"), { recursive: true });
		await mkdir(path.join(publicDirectory, "workers"), { recursive: true });
		await mkdir(path.join(publicDirectory, "releases", releaseId), {
			recursive: true,
		});
		await writeFile(
			path.join(nextStaticDirectory, "chunks/site.css"),
			"body{margin:0}\n",
		);
		await writeFile(path.join(publicDirectory, "favicon.svg"), "<svg/>\n");
		await writeFile(path.join(publicDirectory, "_headers"), "/*\n");
		await writeFile(
			path.join(publicDirectory, "workers", workerName),
			"self.onmessage=()=>{};\n",
		);
		await writeFile(
			path.join(publicDirectory, "releases", releaseId, "search.json"),
			"{}\n",
		);
		await writeFile(
			path.join(publicDirectory, "releases", releaseId, "facets.json"),
			"{}\n",
		);
		const base = parseEventDocument(
			"release-parity-event",
			await readFile(
				path.join(process.cwd(), "tests/fixtures/release-parity-event.md"),
				"utf8",
			),
		);
		const events = Array.from({ length: options.eventCount }, (_, index) =>
			createSyntheticEvent(base, index),
		);
		const startedAt = performance.now();
		const result = await generateStaticPublicSite({
			discovery: {
				releaseId,
				searchIndexUrl: `/releases/${releaseId}/search.json`,
				workerUrl: `/workers/${workerName}`,
			},
			events,
			nextStaticDirectory,
			origin: "https://toen.stijnvh.workers.dev",
			outputDirectory,
			publicDirectory,
		});
		const elapsedMilliseconds = performance.now() - startedAt;
		const aggregateBytes = await totalFileBytes(outputDirectory);
		const projectedWithOneMediaPerEvent = result.fileCount + options.eventCount;
		const gates = {
			fileHardStop: projectedWithOneMediaPerEvent <= 18_000,
			htmlTarget: result.htmlFileCount <= 10_500,
			noRuntimeSidecars: result.paths.every(
				(entry) =>
					!entry.endsWith(".rsc") &&
					!entry.endsWith(".map") &&
					!entry.endsWith(".md") &&
					!entry.includes("__next"),
			),
			publicTarget: projectedWithOneMediaPerEvent <= 16_000,
		};
		const report = {
			schemaVersion: 1,
			eventCount: options.eventCount,
			fileCount: result.fileCount,
			htmlFileCount: result.htmlFileCount,
			projectedWithOneMediaPerEvent,
			aggregateBytes,
			elapsedMilliseconds,
			peakRssBytes: process.memoryUsage.rss(),
			gates,
		};
		await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
		console.log(JSON.stringify(report));
		if (Object.values(gates).some((passed) => !passed)) {
			throw new Error("Static site benchmark failed required gates");
		}
		if (options.keep) {
			console.log(
				JSON.stringify({ event: "static-site-benchmark-kept", root }),
			);
			return;
		}
	} finally {
		if (!options.keep) await rm(root, { recursive: true, force: true });
	}
}

function createSyntheticEvent(base: Event, index: number): Event {
	const ordinal = String(index + 1).padStart(5, "0");
	const topic = `topic-${String((index % 8) + 1).padStart(2, "0")}`;
	return {
		...base,
		body: `${base.body}\n\nSynthetic catalog record ${ordinal}.`,
		date: {
			...base.date,
			era: index % 7 === 0 ? "bce" : "ce",
			year: 500 + (index % 2_500),
		},
		slug: `synthetic-event-${ordinal}`,
		summary: `Representative static history summary for synthetic event ${ordinal}.`,
		title: `Synthetic history event ${ordinal}`,
		topicLabels: { [topic]: `Topic ${(index % 8) + 1}` },
		topics: [topic],
	};
}

async function totalFileBytes(root: string): Promise<number> {
	let total = 0;
	for (const entry of await readdir(root, { withFileTypes: true })) {
		const target = path.join(root, entry.name);
		if (entry.isDirectory()) total += await totalFileBytes(target);
		else if (entry.isFile()) total += (await stat(target)).size;
	}
	return total;
}

function parseArguments(arguments_: string[]) {
	let eventCount = 5_000;
	let reportPath = "/tmp/toen-static-site-5000.json";
	let keep = false;
	for (const argument of arguments_) {
		if (argument === "--") continue;
		if (argument.startsWith("--events=")) {
			eventCount = Number(argument.slice("--events=".length));
		} else if (argument.startsWith("--output=")) {
			reportPath = path.resolve(argument.slice("--output=".length));
		} else if (argument === "--keep") {
			keep = true;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (
		!Number.isSafeInteger(eventCount) ||
		eventCount < 1 ||
		eventCount > 5_000
	) {
		throw new Error("--events must be an integer from 1 through 5000");
	}
	return { eventCount, keep, reportPath };
}

void main();
