import { describe, expect, it } from "vitest";
import {
	buildCandidateSearchIndex,
	createSyntheticEventDocument,
	createSyntheticEventSlug,
	evaluateBudgetGates,
	measureCompressedJson,
	projectStaticAssetCount,
	runArchitectureBenchmark,
	runBenchmarkCommand,
} from "../scripts/benchmark-architecture.mjs";
import { parseEventDocument } from "../src/lib/content/event-document";

describe("static-first architecture benchmark", () => {
	it("generates deterministic valid synthetic documents outside canonical content", () => {
		const slug = createSyntheticEventSlug(0);
		const document = createSyntheticEventDocument(0);

		expect(slug).toBe("synthetic-event-00001");
		expect(createSyntheticEventDocument(0)).toBe(document);
		expect(parseEventDocument(slug, document)).toMatchObject({
			slug,
			title: "Synthetic event 00001",
			date: { year: 1, era: "bce", precision: "day", month: 1, day: 1 },
		});
		expect(() =>
			parseEventDocument(
				slug,
				document.replace(
					"https://example.com/sources/00001",
					"javascript:alert(1)",
				),
			),
		).toThrow();
	});

	it("builds a deterministic compact search projection", () => {
		const first = buildCandidateSearchIndex(12);
		const second = buildCandidateSearchIndex(12);
		const measured = measureCompressedJson(first);

		expect(second).toEqual(first);
		expect(first).toMatchObject({ schemaVersion: 1 });
		expect(first.events).toHaveLength(12);
		expect(measured.rawBytes).toBeGreaterThan(measured.brotliBytes);
		expect(measured.sha256).toMatch(/^[0-9a-f]{64}$/);
	});

	it("keeps one media asset per event below reserved Static Assets headroom", () => {
		expect(projectStaticAssetCount(5_000, 5_000, 5_000)).toEqual({
			projectionOnly: true,
			articlePages: 5_000,
			playPages: 5_000,
			mediaFiles: 5_000,
			archivePages: 281,
			sharedAssetsAllowance: 128,
			totalFiles: 15_409,
			targetFiles: 16_000,
			ciHardStopFiles: 18_000,
			cloudflareFreeLimitFiles: 20_000,
			withinTarget: true,
			withinCiHardStop: true,
			withinCloudflareFreeLimit: true,
		});
	});

	it("fails required budget gates when a measurement is missing or over limit", () => {
		const staticAssets = projectStaticAssetCount(5_000, 5_000, 5_000);
		const media = {
			projectedRenditionBytes: 3 * 1024 ** 3,
			projectedFullReplacementRollbackBytes: 6 * 1024 ** 3,
			r2TargetBytes: 6 * 1024 ** 3,
			r2FreeStorageBytes: 10 * 1024 ** 3,
			operations: {
				monthlyClassAUpperBound: 750,
				monthlyClassBUpperBoundBeforeCache: 1_000_000,
				r2FreeClassAOperations: 1_000_000,
				r2FreeClassBOperations: 10_000_000,
			},
		};
		const search = {
			rawBytes: 1_000,
			brotliBytes: 500,
			browser: {
				worker: { searchP95Ms: 10 },
				longTaskObserverSupported: true,
				targetLongTasks: [],
			},
		};

		expect(
			evaluateBudgetGates({ search, staticAssets, media, current: null })
				.allRequiredPass,
		).toBe(true);
		const failed = evaluateBudgetGates({
			search: { ...search, rawBytes: 3 * 1024 ** 2 },
			staticAssets,
			media,
			current: null,
		});
		expect(failed.allRequiredPass).toBe(false);
		expect(failed.gates).toContainEqual(
			expect.objectContaining({ id: "search-raw-target", status: "fail" }),
		);
		const missing = evaluateBudgetGates({
			search: {
				...search,
				browser: {
					...search.browser,
					longTaskObserverSupported: false,
				},
			},
			staticAssets,
			media,
			current: null,
		});
		expect(missing.allRequiredPass).toBe(false);
		expect(missing.gates).toContainEqual(
			expect.objectContaining({
				id: "browser-main-thread-long-task",
				status: "missing",
			}),
		);
	});

	it("rejects command spawn failures without waiting for benchmark timeout", async () => {
		await expect(
			runBenchmarkCommand("missing-toen-benchmark-command", [], {
				cwd: process.cwd(),
				timeoutMs: 1_000,
			}),
		).rejects.toThrow();
	});

	it("terminates an active command when benchmark signal aborts", async () => {
		const controller = new AbortController();
		const command = runBenchmarkCommand(
			process.execPath,
			["-e", "setTimeout(() => {}, 60_000)"],
			{
				cwd: process.cwd(),
				timeoutMs: 60_000,
				signal: controller.signal,
			},
		);
		setTimeout(() => controller.abort(), 25);

		await expect(command).resolves.toMatchObject({
			aborted: true,
			signal: "SIGTERM",
		});
	});

	it("validates programmatic boundaries before work starts", async () => {
		await expect(
			runArchitectureBenchmark({
				includeCurrentBuild: false,
				timeoutMs: 999,
			}),
		).rejects.toThrow("at least 1,000 ms");
		expect(() => createSyntheticEventSlug(99_999)).toThrow(
			"between 0 and 99,998",
		);
		expect(() => buildCandidateSearchIndex(100_000)).toThrow(
			"between 1 and 99,999",
		);
	});
});
