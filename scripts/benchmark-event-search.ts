import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";
import { chromium } from "@playwright/test";
import type { EventCatalogEntry } from "../src/lib/content/event-catalog";
import { createEventSearchArtifact } from "../src/lib/content/search-artifact";
import { buildBrowserWorkers } from "./build-browser-workers";

const eventCount = 5_000;
const releaseId = "c".repeat(64);

async function main() {
	const root = await mkdtemp(path.join(tmpdir(), "toen-search-benchmark-"));
	const publicDirectory = path.join(root, "public");
	const generatedDirectory = path.join(root, ".generated");
	const outputPath =
		process.argv[2] ?? path.join(tmpdir(), "toen-search-5000.json");

	try {
		const worker = await buildBrowserWorkers({
			appRoot: process.cwd(),
			publicDirectory,
			generatedDirectory,
		});
		const artifact = createEventSearchArtifact(
			Array.from({ length: eventCount }, (_, index) => syntheticEvent(index)),
			{ releaseId },
		);
		const searchBytes = Buffer.from(JSON.stringify(artifact));
		const searchPath = `/releases/${releaseId}/search.json`;
		const workerBytes = await readFile(
			path.join(publicDirectory, worker.workerUrl.slice(1)),
		);
		const server = createServer((request, response) => {
			if (request.url === searchPath) {
				response.writeHead(200, {
					"Content-Type": "application/json; charset=utf-8",
					"Content-Length": searchBytes.byteLength,
				});
				response.end(searchBytes);
				return;
			}
			if (request.url === worker.workerUrl) {
				response.writeHead(200, {
					"Content-Type": "text/javascript; charset=utf-8",
					"Content-Length": workerBytes.byteLength,
				});
				response.end(workerBytes);
				return;
			}
			response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			response.end('<main><ol id="results"></ol></main>');
		});
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const address = server.address();
		if (!address || typeof address === "string")
			throw new Error("Missing server port");
		const origin = `http://127.0.0.1:${address.port}`;
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage();
			const session = await page.context().newCDPSession(page);
			await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
			await page.goto(origin);
			await page.addScriptTag({
				type: "module",
				content: `
window.__toenSearchMeasurement = (async () => {
  const indexUrl = ${JSON.stringify(searchPath)};
  const workerUrl = ${JSON.stringify(worker.workerUrl)};
  const longTasks = [];
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  });
  observer.observe({ type: "longtask", buffered: true });
  const searchWorker = new Worker(workerUrl, { type: "module" });
  let requestId = 0;
  const pending = new Map();
  searchWorker.onmessage = (event) => {
    const waiter = pending.get(event.data.requestId);
    if (!waiter) return;
    pending.delete(event.data.requestId);
    if (event.data.kind === "error") waiter.reject(new Error(event.data.message));
    else waiter.resolve(event.data);
  };
  const search = (query, topics = []) => {
    requestId += 1;
    const id = requestId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      searchWorker.postMessage({
        kind: "search",
        requestId: id,
        indexUrl,
        preferences: {
          selectedDate: "2026-06-01",
          yearMin: -3000,
          yearMax: 3000,
          topics,
          query
        },
        offset: 0,
        limit: 24
      });
    });
  };
  const coldStarted = performance.now();
  await search("geschiedenis");
  const coldRoundTripMs = performance.now() - coldStarted;
  const queries = ["event", "ruimtevaart", "00042", "beslissing", ""];
  const durations = [];
  let resultNodes = 0;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const started = performance.now();
    const result = await search(
      queries[iteration % queries.length] || "",
      iteration % 2 === 0 ? ["wetenschap"] : []
    );
    durations.push(performance.now() - started);
    const list = document.querySelector("#results");
    list.replaceChildren(...result.events.map((entry) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = "/events/" + entry.event.slug;
      link.textContent = entry.event.title;
      item.appendChild(link);
      return item;
    }));
    resultNodes = list.querySelectorAll("*").length;
  }
  durations.sort((left, right) => left - right);
  await new Promise((resolve) => setTimeout(resolve, 0));
  observer.disconnect();
  searchWorker.terminate();
  return {
    coldRoundTripMs,
    searchP95Ms: durations[Math.ceil(durations.length * 0.95) - 1],
    searchMaximumMs: durations.at(-1),
    mainThreadLongTasks: longTasks,
    resultNodes
  };
})();`,
			});
			const measurement = (await page.evaluate(
				"window.__toenSearchMeasurement",
			)) as {
				coldRoundTripMs: number;
				searchP95Ms: number;
				searchMaximumMs: number;
				mainThreadLongTasks: number[];
				resultNodes: number;
			};
			const report = {
				schemaVersion: 1,
				eventCount,
				browser: await browser.version(),
				cpuThrottleRate: 4,
				searchBytes: searchBytes.byteLength,
				searchBrotliBytes: brotliCompressSync(searchBytes).byteLength,
				workerBytes: worker.bytes,
				...measurement,
				gates: {
					searchP95Under50Ms: measurement.searchP95Ms < 50,
					noMainThreadTaskOver50Ms: measurement.mainThreadLongTasks.every(
						(duration) => duration <= 50,
					),
					boundedResultDom: measurement.resultNodes <= 48,
				},
			};
			await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
			console.log(
				JSON.stringify({ event: "event-search-benchmarked", outputPath }),
			);
			console.log(JSON.stringify(report, null, 2));
		} finally {
			await browser.close();
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

function syntheticEvent(index: number): EventCatalogEntry {
	const sequence = String(index + 1).padStart(5, "0");
	const topic = index % 2 === 0 ? "wetenschap" : "politiek";
	return {
		slug: `synthetic-event-${sequence}`,
		title: `Synthetic history event ${sequence}`,
		date: {
			year: (index % 2_500) + 1,
			era: index % 2 === 0 ? "bce" : "ce",
			precision: "day",
			month: (index % 12) + 1,
			day: (index % 28) + 1,
		},
		summary: `Representative Dutch classroom summary ${sequence} for geschiedenis and decision making`,
		topics: [topic],
		topicLabels: {
			[topic]: topic === "wetenschap" ? "Ruimtevaart" : "Politiek",
		},
		activity: {
			mechanic: "context-decision",
			question: `Welke beslissing past bij gebeurtenis ${sequence}?`,
			durations: [5, 8, 12],
		},
	};
}
