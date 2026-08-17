import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEventDocument } from "../src/lib/content/event-document";
import {
	generateStaticPublicSite,
	inspectStaticPublicSite,
} from "../src/lib/content/static-site";

const origin = "https://toen.stijnvh.workers.dev";

describe("static public site", () => {
	it("emits one crawlable article and classroom HTML file without Next sidecars", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-static-site-"));
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
			"body{}\n",
		);
		await writeFile(path.join(nextStaticDirectory, "media/font.woff2"), "font");
		await writeFile(path.join(publicDirectory, "favicon.svg"), "<svg/>\n");
		await writeFile(
			path.join(publicDirectory, "_headers"),
			"/*\n  X-Test: yes\n",
		);
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
		const event = parseEventDocument(
			"release-parity-event",
			await readFile(
				path.join(process.cwd(), "tests/fixtures/release-parity-event.md"),
				"utf8",
			),
		);
		event.title = 'Unsafe </script><script data-injected="yes"> title';

		const result = await generateStaticPublicSite({
			discovery: {
				releaseId,
				searchIndexUrl: `/releases/${releaseId}/search.json`,
				workerUrl: `/workers/${workerName}`,
			},
			events: [event],
			nextStaticDirectory,
			origin,
			outputDirectory,
			publicDirectory,
		});

		expect(result.eventCount).toBe(1);
		expect(result.htmlFileCount).toBeGreaterThanOrEqual(7);
		const article = await readFile(
			path.join(outputDirectory, "events/release-parity-event.html"),
			"utf8",
		);
		expect(article).toContain("<!doctype html>");
		expect(article).toContain("<article");
		expect(article).toContain("application/ld+json");
		expect(article).toContain(`${origin}/events/release-parity-event`);
		expect(article).toContain('property="og:type" content="article"');
		expect(article).toContain("Mission report");
		expect(article).not.toContain('</script><script data-injected="yes">');
		expect(article).toContain("\\u003c/script\\u003e");
		const structuredData = article.match(
			/<script type="application\/ld\+json">([^<]+)<\/script>/,
		)?.[1];
		expect(structuredData).toBeDefined();
		expect(JSON.parse(structuredData ?? "{}")["@graph"]).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ "@type": "Article" }),
				expect.objectContaining({ "@type": "LearningResource" }),
			]),
		);

		const classroom = await readFile(
			path.join(outputDirectory, "events/release-parity-event/play.html"),
			"utf8",
		);
		expect(classroom).toContain('name="robots" content="noindex,follow"');
		expect(classroom).toContain(
			`rel="canonical" href="${origin}/events/release-parity-event"`,
		);
		expect(classroom).toContain("data-beat-preparation");
		expect(classroom).toContain('type="module"');

		const sitemap = await readFile(
			path.join(outputDirectory, "sitemap.xml"),
			"utf8",
		);
		expect(sitemap).toContain(
			`<loc>${origin}/events/release-parity-event</loc>`,
		);
		expect(sitemap).not.toContain("/play");
		expect(
			await readFile(path.join(outputDirectory, "robots.txt"), "utf8"),
		).toContain(`${origin}/sitemap.xml`);

		const inspection = await inspectStaticPublicSite(outputDirectory);
		expect(inspection.fileCount).toBe(result.fileCount);
		expect(inspection.paths.filter((entry) => entry.endsWith(".rsc"))).toEqual(
			[],
		);
		expect(
			inspection.paths.filter((entry) => entry.includes("__next")),
		).toEqual([]);
		expect(
			inspection.paths.filter(
				(entry) => entry === "events/release-parity-event.html",
			),
		).toHaveLength(1);
		expect(
			inspection.paths.filter(
				(entry) => entry === "events/release-parity-event/play.html",
			),
		).toHaveLength(1);

		const externalWorkers = path.join(root, "external-workers");
		await mkdir(externalWorkers);
		await writeFile(
			path.join(externalWorkers, workerName),
			"self.onmessage=()=>{};\n",
		);
		await rm(path.join(publicDirectory, "workers"), { recursive: true });
		await symlink(
			externalWorkers,
			path.join(publicDirectory, "workers"),
			"dir",
		);
		await expect(
			generateStaticPublicSite({
				discovery: {
					releaseId,
					searchIndexUrl: `/releases/${releaseId}/search.json`,
					workerUrl: `/workers/${workerName}`,
				},
				events: [event],
				nextStaticDirectory,
				origin,
				outputDirectory: path.join(root, "linked-site"),
				publicDirectory,
			}),
		).rejects.toThrow("symbolic link");
	});

	it("rejects output symlinks and file counts above release hard stop", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-static-inspect-"));
		await mkdir(path.join(root, "nested"));
		await writeFile(path.join(root, "nested/index.html"), "ok");
		expect(
			await inspectStaticPublicSite(root, { hardFileLimit: 1 }),
		).toMatchObject({ fileCount: 1 });
		await writeFile(path.join(root, "second.html"), "extra");
		await expect(
			inspectStaticPublicSite(root, { hardFileLimit: 1 }),
		).rejects.toThrow("exceeds hard limit 1");
		await symlink(
			path.join(root, "nested/index.html"),
			path.join(root, "linked.html"),
		);
		await expect(
			inspectStaticPublicSite(root, { hardFileLimit: 10 }),
		).rejects.toThrow("symbolic link");
	});
});
