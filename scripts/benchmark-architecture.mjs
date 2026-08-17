import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import {
	arch,
	cpus,
	homedir,
	platform,
	release,
	tmpdir,
	totalmem,
	type,
} from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const defaultEventCount = 5_000;
const maximumCapturedOutputBytes = 128 * 1024;
const processSampleIntervalMs = 250;
const defaultTimeoutMs = 30 * 60 * 1_000;
const staticAssetTargetFiles = 16_000;
const staticAssetHardLimitFiles = 18_000;
const cloudflareStaticAssetLimitFiles = 20_000;
const r2TargetBytes = 6 * 1024 ** 3;
const r2FreeStorageBytes = 10 * 1024 ** 3;
const r2FreeClassAOperations = 1_000_000;
const r2FreeClassBOperations = 10_000_000;
const workerCompressedLimitBytes = 3 * 1024 ** 2;
const workerUncompressedLimitBytes = 64 * 1024 ** 2;
const searchRawTargetBytes = 2.5 * 1024 ** 2;
const searchBrotliTargetBytes = 750 * 1024;
const browserSearchP95TargetMs = 50;
const browserLongTaskLimitMs = 50;
const activeChildren = new Set();

export function createSyntheticEventSlug(index) {
	assertSyntheticIndex(index);
	return `synthetic-event-${String(index + 1).padStart(5, "0")}`;
}

export function createSyntheticEventDocument(index) {
	assertSyntheticIndex(index);
	const sequence = String(index + 1).padStart(5, "0");
	const year = (index % 2_500) + 1;
	const era = index % 2 === 0 ? "bce" : "ce";
	const month = (index % 12) + 1;
	const day = (index % 28) + 1;

	return `---
title: Synthetic event ${sequence}
date:
  year: ${year}
  era: ${era}
  precision: day
  month: ${month}
  day: ${day}
summary: Deterministic benchmark event ${sequence} for architecture capacity measurement.
topics:
  - benchmark
profiles:
  - algemeen
sources:
  - title: Benchmark source ${sequence}
    publisher: Toen benchmark
    url: https://example.com/sources/${sequence}
---

Synthetic benchmark body ${sequence}.
`;
}

export function buildCandidateSearchIndex(eventCount) {
	assertEventCount(eventCount);
	const topicIds = [
		"politiek",
		"oorlog",
		"wetenschap",
		"cultuur",
		"economie",
		"techniek",
	];
	const mechanics = ["vote-revote", "source-duel", "context-decision"];

	return {
		schemaVersion: 1,
		topicLabels: {
			politiek: "Politiek",
			oorlog: "Oorlog",
			wetenschap: "Wetenschap",
			cultuur: "Cultuur",
			economie: "Economie",
			techniek: "Techniek",
		},
		events: Array.from({ length: eventCount }, (_, index) => {
			const sequence = String(index + 1).padStart(5, "0");
			const fingerprint = createHash("sha256")
				.update(`synthetic-search-${sequence}`)
				.digest("hex")
				.slice(0, 32);
			const eraMultiplier = index % 2 === 0 ? -1 : 1;
			return {
				s: createSyntheticEventSlug(index),
				t: `Synthetic history event ${sequence}`,
				u: `Representative Dutch classroom summary ${sequence} ${fingerprint}`,
				y: eraMultiplier * ((index % 2_500) + 1),
				p: "d",
				m: (index % 12) + 1,
				d: (index % 28) + 1,
				x: [topicIds[index % topicIds.length]],
				q: `Welke historische keuze past bij gebeurtenis ${sequence}?`,
				a: mechanics[index % mechanics.length],
				r: [5, 8, 12],
			};
		}),
	};
}

export function measureCompressedJson(value) {
	const serialized = JSON.stringify(value);
	const buffer = Buffer.from(serialized);
	return {
		rawBytes: buffer.byteLength,
		gzipBytes: gzipSync(buffer).byteLength,
		brotliBytes: brotliCompressSync(buffer).byteLength,
		sha256: createHash("sha256").update(buffer).digest("hex"),
	};
}

export function projectStaticAssetCount(
	articlePages,
	playPages,
	mediaFiles = 0,
) {
	assertEventCount(articlePages);
	if (!Number.isSafeInteger(playPages) || playPages < 0) {
		throw new Error("Play page count must be a non-negative safe integer");
	}
	if (!Number.isSafeInteger(mediaFiles) || mediaFiles < 0) {
		throw new Error("Media file count must be a non-negative safe integer");
	}
	const archivePages = 281;
	const sharedAssetsAllowance = 128;
	const totalFiles =
		articlePages +
		playPages +
		mediaFiles +
		archivePages +
		sharedAssetsAllowance;
	return {
		projectionOnly: true,
		articlePages,
		playPages,
		mediaFiles,
		archivePages,
		sharedAssetsAllowance,
		totalFiles,
		targetFiles: staticAssetTargetFiles,
		ciHardStopFiles: staticAssetHardLimitFiles,
		cloudflareFreeLimitFiles: cloudflareStaticAssetLimitFiles,
		withinTarget: totalFiles <= staticAssetTargetFiles,
		withinCiHardStop: totalFiles <= staticAssetHardLimitFiles,
		withinCloudflareFreeLimit: totalFiles <= cloudflareStaticAssetLimitFiles,
	};
}

export async function runArchitectureBenchmark({
	appRoot = process.cwd(),
	eventCount = defaultEventCount,
	includeCurrentBuild = true,
	keepWorktree = false,
	outputPath = path.join(
		tmpdir(),
		`toen-architecture-benchmark-${eventCount}.json`,
	),
	timeoutMs = defaultTimeoutMs,
	signal,
} = {}) {
	assertEventCount(eventCount);
	assertTimeout(timeoutMs);
	signal?.throwIfAborted();
	if (includeCurrentBuild && !["darwin", "linux"].includes(process.platform)) {
		throw new Error(
			"Current-build benchmark supports macOS and Linux process-tree measurement only",
		);
	}
	const startedAt = new Date().toISOString();
	const provenance = await collectProvenance(appRoot, signal);
	const searchIndex = buildCandidateSearchIndex(eventCount);
	const search = {
		projectionOnly: true,
		...measureCompressedJson(searchIndex),
		nodeCandidateSearchP95Ms: measureCandidateSearchP95(searchIndex.events),
		browser: await measureBrowserCandidateSearch(searchIndex, signal),
	};
	const staticAssets = projectStaticAssetCount(
		eventCount,
		eventCount,
		eventCount,
	);
	const media = await measureMediaProjection(appRoot, eventCount);
	const current = includeCurrentBuild
		? await measureCurrentArchitecture({
				appRoot,
				eventCount,
				keepWorktree,
				timeoutMs,
				signal,
			})
		: null;
	const gates = evaluateBudgetGates({ search, staticAssets, media, current });
	const deterministicProjection = {
		eventCount,
		search: {
			rawBytes: search.rawBytes,
			gzipBytes: search.gzipBytes,
			brotliBytes: search.brotliBytes,
			sha256: search.sha256,
		},
		staticAssets,
		media,
	};
	const report = {
		schemaVersion: 2,
		startedAt,
		finishedAt: new Date().toISOString(),
		provenance,
		assumptions: [
			"Current-build fixture cycles verified canonical documents and is not publishable history content.",
			"Worst-case static projection reserves one article, one classroom page, and one media file per event plus 24 period and 256 topic archives.",
			"Static file counts remain arithmetic projections until the static generator exists.",
			"Candidate search projection is provisional until the release artifact contract is frozen.",
			"Chromium uses 4x CPU throttling as a reproducible low-end proxy, not physical-device evidence.",
			"Optional private R2 operation counts are build-input scenarios, not observed traffic forecasts.",
		],
		deterministicProjectionSha256: createHash("sha256")
			.update(JSON.stringify(deterministicProjection))
			.digest("hex"),
		eventCount,
		search,
		staticAssets,
		media,
		current,
		gates,
	};

	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(`Architecture benchmark report: ${outputPath}`);
	return { report, outputPath };
}

async function collectProvenance(appRoot, signal) {
	const revision = await runCommand("git", ["rev-parse", "HEAD"], {
		cwd: appRoot,
		timeoutMs: 30_000,
		signal,
	});
	assertCommandSucceeded(revision, "resolve application revision");
	const status = await runCommand("git", ["status", "--porcelain"], {
		cwd: appRoot,
		timeoutMs: 30_000,
		signal,
	});
	assertCommandSucceeded(status, "inspect application worktree");
	const pnpm = await runCommand("pnpm", ["--version"], {
		cwd: appRoot,
		timeoutMs: 30_000,
		signal,
	});
	assertCommandSucceeded(pnpm, "resolve pnpm version");
	const contentRevision = JSON.parse(
		await readFile(path.join(appRoot, "content", "revision.json"), "utf8"),
	);
	const contentDirectory = path.join(appRoot, "content", "events");
	const templateNames = (await readdir(contentDirectory))
		.filter((name) => name.endsWith(".md"))
		.sort();
	const templates = await Promise.all(
		templateNames.map(async (name) => {
			const document = await readFile(path.join(contentDirectory, name));
			return {
				name,
				bytes: document.byteLength,
				sha256: createHash("sha256").update(document).digest("hex"),
			};
		}),
	);
	const cpuList = cpus();
	const workingTree = await collectWorkingTreeProvenance(appRoot, signal);

	return {
		appRoot: appRoot.replace(homedir(), "~"),
		applicationSha: revision.stdoutTail.trim(),
		applicationWorktreeDirty: Boolean(status.stdoutTail.trim()),
		workingTree,
		contentRevision,
		templates,
		runtime: {
			node: process.version,
			pnpm: pnpm.stdoutTail.trim(),
			next: await readPackageVersion(appRoot, "next"),
			openNextCloudflare: await readPackageVersion(
				appRoot,
				"@opennextjs/cloudflare",
			),
			wrangler: await readPackageVersion(appRoot, "wrangler"),
		},
		host: {
			type: type(),
			release: release(),
			platform: platform(),
			architecture: arch(),
			cpuModel: cpuList[0]?.model ?? "unknown",
			logicalCpuCount: cpuList.length,
			totalMemoryBytes: totalmem(),
		},
	};
}

async function collectWorkingTreeProvenance(appRoot, signal) {
	const trackedDiff = await runCommand("git", ["diff", "--binary", "HEAD"], {
		cwd: appRoot,
		timeoutMs: 30_000,
		captureLimitBytes: 16 * 1024 ** 2,
		signal,
	});
	assertCommandSucceeded(trackedDiff, "capture tracked benchmark diff");
	const untrackedList = await runCommand(
		"git",
		["ls-files", "--others", "--exclude-standard", "-z"],
		{
			cwd: appRoot,
			timeoutMs: 30_000,
			captureLimitBytes: 16 * 1024 ** 2,
			signal,
		},
	);
	assertCommandSucceeded(untrackedList, "capture untracked benchmark files");
	const untracked = [];
	for (const relativePath of untrackedList.stdoutTail
		.split("\0")
		.filter(Boolean)) {
		const contents = await readFile(path.join(appRoot, relativePath));
		untracked.push({
			path: relativePath,
			bytes: contents.byteLength,
			sha256: createHash("sha256").update(contents).digest("hex"),
		});
	}
	const trackedDiffSha256 = createHash("sha256")
		.update(trackedDiff.stdoutTail)
		.digest("hex");
	const benchmarkScript = await readFile(
		path.join(appRoot, "scripts", "benchmark-architecture.mjs"),
	);
	const benchmarkScriptSha256 = createHash("sha256")
		.update(benchmarkScript)
		.digest("hex");
	return {
		trackedDiffBytes: Buffer.byteLength(trackedDiff.stdoutTail),
		trackedDiffSha256,
		untracked,
		benchmarkScriptSha256,
		combinedSha256: createHash("sha256")
			.update(JSON.stringify({ trackedDiffSha256, untracked }))
			.digest("hex"),
	};
}

async function readPackageVersion(appRoot, packageName) {
	const packageJson = JSON.parse(
		await readFile(
			path.join(
				appRoot,
				"node_modules",
				...packageName.split("/"),
				"package.json",
			),
			"utf8",
		),
	);
	return packageJson.version;
}

async function measureCurrentArchitecture({
	appRoot,
	eventCount,
	keepWorktree,
	timeoutMs,
	signal,
}) {
	const temporaryRoot = await mkdtemp(
		path.join(tmpdir(), "toen-architecture-benchmark-"),
	);
	const worktree = path.join(temporaryRoot, "app");
	let worktreeCreated = false;
	const cleanup = {
		requested: !keepWorktree,
		worktreeRemoved: false,
		fallbackPruned: false,
		temporaryRootRemoved: false,
		errors: [],
	};
	let result;
	let failure;

	try {
		const worktreeSetup = await runCommand(
			"git",
			["worktree", "add", "--detach", worktree, "HEAD"],
			{
				cwd: appRoot,
				timeoutMs: 60_000,
				signal,
			},
		);
		assertCommandSucceeded(worktreeSetup, "create benchmark worktree");
		worktreeCreated = true;
		const dependencySetup = await prepareDependencies(worktree, signal);
		assertCommandSucceeded(dependencySetup, "install benchmark dependencies");
		const fixture = await materializeSyntheticCatalog({
			appRoot,
			worktree,
			eventCount,
		});
		const contentValidation = await validateSyntheticCatalog({
			worktree,
			signal,
		});
		assertCommandSucceeded(
			contentValidation.execution,
			"validate synthetic catalog",
		);
		const developmentSearch = await runCommand("pnpm", ["content:search:dev"], {
			cwd: worktree,
			timeoutMs: 5 * 60_000,
			signal,
		});
		assertCommandSucceeded(
			developmentSearch,
			"generate benchmark search asset",
		);
		const browserWorkers = await runCommand("pnpm", ["assets:workers"], {
			cwd: worktree,
			timeoutMs: 5 * 60_000,
			signal,
		});
		assertCommandSucceeded(browserWorkers, "build benchmark browser Workers");
		const staticMedia = await runCommand("pnpm", ["assets:media"], {
			cwd: worktree,
			timeoutMs: 5 * 60_000,
			signal,
		});
		assertCommandSucceeded(staticMedia, "stage benchmark static media");
		const build = await runCommand("pnpm", ["build:static:synced"], {
			cwd: worktree,
			timeoutMs,
			env: {
				...process.env,
				CI: "1",
				NEXT_TELEMETRY_DISABLED: "1",
				TOEN_ALLOW_DEVELOPMENT_SEARCH: "1",
			},
			streamOutput: true,
			signal,
		});
		const nextOutput = await measureDirectory(path.join(worktree, ".next"));
		const staticOutput = await measureDirectory(
			path.join(worktree, ".generated", "static-site"),
		);
		const generatedRoutes = await countGeneratedEventRoutes(worktree);
		const homePayload = await measureHomePayload(worktree);

		let wrangler = null;
		let startup = null;
		if (build.exitCode === 0) {
			const dryRunOutput = path.join(temporaryRoot, "wrangler-dry-run");
			wrangler = await runCommand(
				"pnpm",
				[
					"exec",
					"wrangler",
					"deploy",
					"--dry-run",
					"--config",
					"wrangler.static.jsonc",
					"--outdir",
					dryRunOutput,
				],
				{
					cwd: worktree,
					timeoutMs: 5 * 60_000,
					signal,
				},
			);
			wrangler.upload = parseWranglerUpload(
				`${wrangler.stdoutTail}\n${wrangler.stderrTail}`,
			);
			startup = await runCommand(
				"pnpm",
				[
					"exec",
					"wrangler",
					"check",
					"startup",
					"--args=--config wrangler.static.jsonc",
					`--outfile=${path.join(temporaryRoot, "worker-startup.cpuprofile")}`,
				],
				{
					cwd: worktree,
					timeoutMs: 5 * 60_000,
					signal,
				},
			);
			startup.profile = parseWranglerStartup(
				`${startup.stdoutTail}\n${startup.stderrTail}`,
			);
		}

		result = {
			dependencySetup,
			fixture,
			contentValidation,
			developmentSearch,
			browserWorkers,
			staticMedia,
			build,
			wrangler,
			startup,
			nextOutput,
			staticOutput,
			generatedRoutes,
			homePayload,
			cleanup,
			worktreeRetainedAt: keepWorktree ? worktree : null,
		};
	} catch (error) {
		failure = error;
	}

	if (!keepWorktree) {
		if (worktreeCreated) {
			try {
				const removal = await runCommand(
					"git",
					["worktree", "remove", "--force", worktree],
					{
						cwd: appRoot,
						timeoutMs: 120_000,
					},
				);
				assertCommandSucceeded(removal, "remove benchmark worktree");
				cleanup.worktreeRemoved = true;
			} catch (error) {
				cleanup.errors.push(
					error instanceof Error ? error.message : String(error),
				);
				try {
					await rm(worktree, { recursive: true, force: true });
					const prune = await runCommand("git", ["worktree", "prune"], {
						cwd: appRoot,
						timeoutMs: 60_000,
					});
					assertCommandSucceeded(prune, "prune benchmark worktree metadata");
					cleanup.worktreeRemoved = true;
					cleanup.fallbackPruned = true;
				} catch (fallbackError) {
					cleanup.errors.push(
						fallbackError instanceof Error
							? fallbackError.message
							: String(fallbackError),
					);
				}
			}
		}
		try {
			await rm(temporaryRoot, { recursive: true, force: true });
			cleanup.temporaryRootRemoved = true;
		} catch (error) {
			cleanup.errors.push(
				error instanceof Error ? error.message : String(error),
			);
		}
		if (cleanup.errors.length > 0) {
			failure ??= new Error(
				`Benchmark cleanup failed: ${cleanup.errors.join("; ")}`,
			);
		}
	}

	if (failure) throw failure;
	return result;
}

async function validateSyntheticCatalog({ worktree, signal }) {
	const benchmarkDirectory = path.join(worktree, ".benchmark");
	const entry = path.join(benchmarkDirectory, "validate-catalog.ts");
	const bundle = path.join(benchmarkDirectory, "validate-catalog.cjs");
	await mkdir(benchmarkDirectory, { recursive: true });
	await writeFile(
		entry,
		`import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { parseEventDocument } from "../src/lib/content/event-document";
async function main() {
  const directory = process.argv[2];
  const started = performance.now();
  const names = (await readdir(directory)).filter((name) => name.endsWith(".md")).sort();
  const documents = await Promise.all(names.map((name) => readFile(path.join(directory, name), "utf8")));
  const events = documents.map((document, index) => parseEventDocument(names[index].slice(0, -3), document));
  console.log(JSON.stringify({ eventCount: events.length, documentBytes: documents.reduce((total, document) => total + Buffer.byteLength(document), 0), validationMs: performance.now() - started }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
`,
	);
	const bundling = await runCommand(
		"pnpm",
		[
			"exec",
			"esbuild",
			entry,
			"--bundle",
			"--platform=node",
			"--format=cjs",
			`--outfile=${bundle}`,
			"--log-level=warning",
		],
		{ cwd: worktree, timeoutMs: 2 * 60_000, signal },
	);
	assertCommandSucceeded(bundling, "bundle catalog validator");
	const execution = await runCommand(
		"node",
		[bundle, path.join(worktree, "content", "events")],
		{ cwd: worktree, timeoutMs: 5 * 60_000, signal },
	);
	const result = parseLastJsonLine(execution.stdoutTail);
	return { bundling, execution, result };
}

async function materializeSyntheticCatalog({ appRoot, worktree, eventCount }) {
	const sourceDirectory = path.join(appRoot, "content", "events");
	const targetDirectory = path.join(worktree, "content", "events");
	const templateNames = (await readdir(sourceDirectory))
		.filter((name) => name.endsWith(".md"))
		.sort();
	if (templateNames.length === 0) {
		throw new Error(
			"Benchmark requires at least one verified canonical template",
		);
	}
	const templates = await Promise.all(
		templateNames.map((name) =>
			readFile(path.join(sourceDirectory, name), "utf8"),
		),
	);
	await mkdir(targetDirectory, { recursive: true });
	let syntheticMarkdownBytes = 0;
	const jobs = Array.from({ length: eventCount }, (_, index) => {
		const document = templates[index % templates.length];
		syntheticMarkdownBytes += Buffer.byteLength(document);
		return async () =>
			writeFile(
				path.join(targetDirectory, `${createSyntheticEventSlug(index)}.md`),
				document,
			);
	});
	await runBounded(jobs, 32);
	await writeFile(
		path.join(worktree, "content", "revision.json"),
		`${JSON.stringify({ sha: "0".repeat(40), synthetic: true }, null, 2)}\n`,
	);
	return {
		templateCount: templates.length,
		eventCount,
		syntheticMarkdownBytes,
		writeConcurrency: 32,
	};
}

async function measureMediaProjection(appRoot, eventCount) {
	const mediaDirectory = path.join(appRoot, "media", "sources");
	let names = [];
	try {
		names = (await readdir(mediaDirectory)).sort();
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
	const files = [];
	for (const name of names) {
		const metadata = await stat(path.join(mediaDirectory, name));
		if (metadata.isFile()) files.push({ name, bytes: metadata.size });
	}
	const currentBytes = files.reduce((total, file) => total + file.bytes, 0);
	const averageBytes = files.length === 0 ? 0 : currentBytes / files.length;
	const renditionCountScenario = 1;
	const projectedSingleRenditionBytes = Math.ceil(averageBytes * eventCount);
	const projectedRenditionBytes =
		projectedSingleRenditionBytes * renditionCountScenario;
	const projectedFullReplacementRollbackBytes = projectedRenditionBytes * 2;
	const monthlyChangedEventsScenario = Math.ceil(eventCount * 0.05);
	const monthlyBuildsScenario = 12;
	const operations = {
		initialIngestClassA: eventCount * renditionCountScenario,
		monthlyChangedEventsScenario,
		monthlyClassAUpperBound:
			monthlyChangedEventsScenario * renditionCountScenario,
		monthlyBuildsScenario,
		monthlyClassBUpperBoundBeforeCache: eventCount * monthlyBuildsScenario,
		r2FreeClassAOperations,
		r2FreeClassBOperations,
	};
	return {
		projectionOnly: true,
		currentFiles: files.length,
		currentBytes,
		averageBytes,
		renditionCountScenario,
		projectedSingleRenditionBytes,
		projectedRenditionBytes,
		projectedFullReplacementRollbackBytes,
		r2TargetBytes,
		r2FreeStorageBytes,
		withinTarget: projectedRenditionBytes <= r2TargetBytes,
		withinFreeStorage:
			projectedFullReplacementRollbackBytes <= r2FreeStorageBytes,
		operations,
	};
}

export function evaluateBudgetGates({ search, staticAssets, media, current }) {
	const browserLongTaskMaximum =
		search.browser.longTaskObserverSupported &&
		Array.isArray(search.browser.targetLongTasks)
			? Math.max(0, ...search.browser.targetLongTasks)
			: null;
	const gates = [
		upperBoundGate(
			"search-raw-target",
			search.rawBytes,
			searchRawTargetBytes,
			true,
		),
		upperBoundGate(
			"search-brotli-target",
			search.brotliBytes,
			searchBrotliTargetBytes,
			true,
		),
		upperBoundGate(
			"browser-search-p95-target",
			search.browser.worker.searchP95Ms,
			browserSearchP95TargetMs,
			true,
		),
		upperBoundGate(
			"browser-main-thread-long-task",
			browserLongTaskMaximum,
			browserLongTaskLimitMs,
			true,
		),
		upperBoundGate(
			"static-assets-target",
			staticAssets.totalFiles,
			staticAssets.targetFiles,
			false,
		),
		upperBoundGate(
			"static-assets-ci-hard-stop",
			staticAssets.totalFiles,
			staticAssets.ciHardStopFiles,
			true,
		),
		upperBoundGate(
			"static-assets-cloudflare-free-limit",
			staticAssets.totalFiles,
			staticAssets.cloudflareFreeLimitFiles,
			true,
		),
		upperBoundGate(
			"r2-storage-target",
			media.projectedRenditionBytes,
			media.r2TargetBytes,
			false,
		),
		upperBoundGate(
			"r2-storage-free-limit-with-full-replacement-rollback",
			media.projectedFullReplacementRollbackBytes,
			media.r2FreeStorageBytes,
			false,
		),
		upperBoundGate(
			"r2-class-a-free-scenario",
			media.operations.monthlyClassAUpperBound,
			media.operations.r2FreeClassAOperations,
			false,
		),
		upperBoundGate(
			"r2-class-b-free-scenario-before-cache",
			media.operations.monthlyClassBUpperBoundBeforeCache,
			media.operations.r2FreeClassBOperations,
			false,
		),
	];

	if (current) {
		gates.push(
			equalityGate(
				"current-build-command-success",
				commandSuccessValue(current.build),
				1,
				true,
			),
			equalityGate(
				"current-content-validation-command-success",
				commandSuccessValue(current.contentValidation.execution),
				1,
				true,
			),
			equalityGate(
				"current-wrangler-dry-run-command-success",
				commandSuccessValue(current.wrangler),
				1,
				true,
			),
			equalityGate(
				"current-worker-startup-command-success",
				commandSuccessValue(current.startup),
				1,
				true,
			),
			upperBoundGate(
				"current-worker-compressed-free-limit",
				current.wrangler?.upload?.gzipBytes ?? null,
				workerCompressedLimitBytes,
				true,
			),
			upperBoundGate(
				"current-worker-uncompressed-free-limit",
				current.wrangler?.upload?.rawBytes ?? null,
				workerUncompressedLimitBytes,
				true,
			),
			equalityGate(
				"current-article-route-count",
				current.generatedRoutes.articleHtml,
				staticAssets.articlePages,
				true,
			),
			equalityGate(
				"current-play-route-count",
				current.generatedRoutes.playHtml,
				staticAssets.playPages,
				true,
			),
			equalityGate(
				"current-content-validation-count",
				current.contentValidation.result?.eventCount ?? null,
				staticAssets.articlePages,
				true,
			),
			equalityGate(
				"current-worker-startup-profile",
				current.startup?.profile ? 1 : null,
				1,
				true,
			),
		);
	}

	return {
		allRequiredPass: gates
			.filter(({ required }) => required)
			.every(({ status }) => status === "pass"),
		gates,
	};
}

function commandSuccessValue(command) {
	if (!command) return null;
	return command.exitCode === 0 && !command.timedOut ? 1 : 0;
}

function upperBoundGate(id, measured, limit, required) {
	return {
		id,
		required,
		comparison: "<=",
		measured,
		limit,
		status:
			typeof measured === "number" && Number.isFinite(measured)
				? measured <= limit
					? "pass"
					: "fail"
				: "missing",
	};
}

function equalityGate(id, measured, expected, required) {
	return {
		id,
		required,
		comparison: "===",
		measured,
		limit: expected,
		status:
			typeof measured === "number" && Number.isFinite(measured)
				? measured === expected
					? "pass"
					: "fail"
				: "missing",
	};
}

function measureCandidateSearchP95(events) {
	const queries = ["history", "classroom", "00042", "wetenschap", "keuze"];
	const durations = [];
	for (let iteration = 0; iteration < 100; iteration += 1) {
		const query = queries[iteration % queries.length];
		const started = performance.now();
		const normalizedQuery = normalizeSearchValue(query);
		for (const event of events) {
			const searchable = normalizeSearchValue(
				`${event.t} ${event.u} ${event.x.join(" ")} ${event.q}`,
			);
			searchable.includes(normalizedQuery);
		}
		durations.push(performance.now() - started);
	}
	durations.sort((left, right) => left - right);
	return durations[Math.ceil(durations.length * 0.95) - 1];
}

function normalizeSearchValue(value) {
	return value
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase("nl-BE")
		.replaceAll(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

async function measureBrowserCandidateSearch(searchIndex, signal) {
	signal?.throwIfAborted();
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch({ headless: true });
	const abortBrowser = () => {
		void browser.close();
	};
	signal?.addEventListener("abort", abortBrowser, { once: true });
	if (signal?.aborted) abortBrowser();
	try {
		const page = await browser.newPage();
		const session = await page.context().newCDPSession(page);
		const cpuThrottleRate = 4;
		await session.send("Emulation.setCPUThrottlingRate", {
			rate: cpuThrottleRate,
		});
		await page.setContent('<main><div id="results"></div></main>');
		const result = await page.evaluate(async (serializedIndex) => {
			const longTasks = [];
			let longTaskObserverSupported = false;
			const observer =
				typeof PerformanceObserver !== "undefined"
					? new PerformanceObserver((list) => {
							for (const entry of list.getEntries()) {
								longTasks.push(entry.duration);
							}
						})
					: null;
			try {
				observer?.observe({ type: "longtask", buffered: true });
				longTaskObserverSupported = Boolean(observer);
			} catch {
				// Some Chromium builds do not expose long-task entries in headless mode.
			}
			const workerSource = `
self.onmessage = (message) => {
  const parseStarted = performance.now();
  const index = JSON.parse(message.data);
  const parseMs = performance.now() - parseStarted;
  const prepareStarted = performance.now();
  const entries = index.events.map((event) => ({
    slug: event.s,
    text: (event.t + " " + event.u + " " + event.x.join(" ") + " " + event.q)
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .toLocaleLowerCase("nl-BE")
      .replace(/[^\\p{L}\\p{N}]+/gu, " ")
      .trim()
  }));
  const prepareMs = performance.now() - prepareStarted;
  const queries = ["history", "classroom", "00042", "wetenschap", "keuze"];
  const durations = [];
  let resultCount = 0;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const query = queries[iteration % queries.length];
    const started = performance.now();
    resultCount = entries.filter((entry) => entry.text.includes(query)).length;
    durations.push(performance.now() - started);
  }
  durations.sort((left, right) => left - right);
  self.postMessage({
    parseMs,
    prepareMs,
    searchP95Ms: durations[Math.ceil(durations.length * 0.95) - 1],
    resultCount
  });
};`;
			const workerUrl = URL.createObjectURL(
				new Blob([workerSource], { type: "text/javascript" }),
			);
			const worker = new Worker(workerUrl);
			const roundTripStarted = performance.now();
			const workerResult = await new Promise((resolve, reject) => {
				worker.onmessage = (message) => resolve(message.data);
				worker.onerror = (error) => reject(new Error(error.message));
				worker.postMessage(serializedIndex);
			});
			const workerRoundTripMs = performance.now() - roundTripStarted;
			worker.terminate();
			URL.revokeObjectURL(workerUrl);

			const root = document.querySelector("#results");
			function renderCards(count) {
				const started = performance.now();
				const fragment = document.createDocumentFragment();
				for (let index = 0; index < count; index += 1) {
					const article = document.createElement("article");
					article.innerHTML = `<h2>Event</h2><p>Summary</p><p><span>Topic</span><span>Duration</span></p><a href="#">Read</a>`;
					fragment.append(article);
				}
				root.replaceChildren(fragment);
				return {
					count,
					renderMs: performance.now() - started,
					domNodes: root.querySelectorAll("*").length,
				};
			}
			const initialResults = renderCards(4);
			const pagedResults = renderCards(24);
			await new Promise((resolve) => setTimeout(resolve, 0));
			const targetLongTasks = [...longTasks];
			const legacyExpandedResults = renderCards(5_000);
			root.replaceChildren();
			observer?.disconnect();
			return {
				worker: { ...workerResult, roundTripMs: workerRoundTripMs },
				dom: { initialResults, pagedResults, legacyExpandedResults },
				longTaskObserverSupported,
				targetLongTasks,
			};
		}, JSON.stringify(searchIndex));
		return {
			projectionOnly: true,
			browser: await browser.version(),
			cpuThrottleRate,
			...result,
		};
	} finally {
		signal?.removeEventListener("abort", abortBrowser);
		await browser.close().catch(() => undefined);
	}
}

async function prepareDependencies(worktree, signal) {
	return runCommand(
		"pnpm",
		["install", "--frozen-lockfile", "--prefer-offline"],
		{
			cwd: worktree,
			timeoutMs: 5 * 60_000,
			signal,
		},
	);
}

async function runBounded(jobs, concurrency) {
	let nextIndex = 0;
	async function worker() {
		while (nextIndex < jobs.length) {
			const index = nextIndex;
			nextIndex += 1;
			await jobs[index]();
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
	);
}

async function runCommand(
	command,
	args,
	{
		cwd,
		env = process.env,
		timeoutMs,
		streamOutput = false,
		captureLimitBytes = maximumCapturedOutputBytes,
		signal = /** @type {AbortSignal | undefined} */ (undefined),
	},
) {
	signal?.throwIfAborted();
	const started = performance.now();
	const child = spawn(command, args, {
		cwd,
		detached: process.platform !== "win32",
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	activeChildren.add(child);
	let stdoutTail = "";
	let stderrTail = "";
	let peakProcessTreeRssBytes = 0;
	let sampleInFlight = false;
	const appendTail = (current, chunk) =>
		`${current}${chunk}`.slice(-captureLimitBytes);
	child.stdout.on("data", (chunk) => {
		stdoutTail = appendTail(stdoutTail, chunk.toString());
		if (streamOutput) process.stdout.write(chunk);
	});
	child.stderr.on("data", (chunk) => {
		stderrTail = appendTail(stderrTail, chunk.toString());
		if (streamOutput) process.stderr.write(chunk);
	});
	const sampler = setInterval(async () => {
		if (sampleInFlight || child.exitCode !== null) return;
		sampleInFlight = true;
		try {
			peakProcessTreeRssBytes = Math.max(
				peakProcessTreeRssBytes,
				await readProcessTreeRssBytes(child.pid),
			);
		} catch {
			// RSS sampling is diagnostic and must not fail the benchmark command.
		} finally {
			sampleInFlight = false;
		}
	}, processSampleIntervalMs);
	let timedOut = false;
	let aborted = false;
	let forceKill;
	const terminate = () => {
		killChildTree(child, "SIGTERM");
		forceKill ??= setTimeout(() => killChildTree(child, "SIGKILL"), 5_000);
	};
	const handleAbort = () => {
		aborted = true;
		terminate();
	};
	signal?.addEventListener("abort", handleAbort, { once: true });
	if (signal?.aborted) handleAbort();
	const timeout = setTimeout(() => {
		timedOut = true;
		terminate();
	}, timeoutMs);
	let outcome;
	try {
		outcome = await new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
		});
	} finally {
		clearInterval(sampler);
		clearTimeout(timeout);
		if (forceKill) clearTimeout(forceKill);
		signal?.removeEventListener("abort", handleAbort);
		activeChildren.delete(child);
	}
	return {
		command: [command, ...args].join(" "),
		exitCode: outcome.exitCode,
		signal: outcome.signal,
		timedOut,
		aborted,
		wallMs: Math.round((performance.now() - started) * 100) / 100,
		peakProcessTreeRssBytes,
		stdoutTail,
		stderrTail,
	};
}

function killChildTree(child, signal) {
	if (!child.pid || child.exitCode !== null) return;
	try {
		if (process.platform === "win32") child.kill(signal);
		else process.kill(-child.pid, signal);
	} catch {
		// Process may have exited between status check and signal delivery.
	}
}

export const runBenchmarkCommand = runCommand;

function cancelActiveCommands() {
	for (const child of activeChildren) {
		killChildTree(child, "SIGTERM");
		const forceKill = setTimeout(() => killChildTree(child, "SIGKILL"), 5_000);
		forceKill.unref();
	}
}

function assertCommandSucceeded(result, action) {
	if (result.exitCode === 0 && !result.timedOut) return;
	throw new Error(
		`Could not ${action}: ${result.stderrTail || result.stdoutTail || result.signal || result.exitCode}`,
	);
}

async function readProcessTreeRssBytes(rootPid) {
	if (!rootPid) return 0;
	const result = await runPs();
	const processes = result
		.trim()
		.split("\n")
		.map((line) => line.trim().split(/\s+/).map(Number))
		.filter(([pid, parentPid, rss]) =>
			[pid, parentPid, rss].every(Number.isFinite),
		)
		.map(([pid, parentPid, rss]) => ({ pid, parentPid, rss }));
	const descendants = new Set([rootPid]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const processInfo of processes) {
			if (
				descendants.has(processInfo.parentPid) &&
				!descendants.has(processInfo.pid)
			) {
				descendants.add(processInfo.pid);
				changed = true;
			}
		}
	}
	return (
		processes
			.filter(({ pid }) => descendants.has(pid))
			.reduce((total, { rss }) => total + rss, 0) * 1024
	);
}

async function runPs() {
	return new Promise((resolve, reject) => {
		const child = spawn("ps", ["-axo", "pid=,ppid=,rss="], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.once("error", reject);
		child.once("close", (exitCode) => {
			if (exitCode === 0) resolve(stdout);
			else reject(new Error(`ps failed: ${stderr.trim()}`));
		});
	});
}

async function measureDirectory(directory) {
	let files = 0;
	let bytes = 0;
	async function visit(current) {
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch (error) {
			if (error?.code === "ENOENT") return;
			throw error;
		}
		for (const entry of entries) {
			const entryPath = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(entryPath);
			else if (entry.isFile()) {
				files += 1;
				bytes += (await stat(entryPath)).size;
			}
		}
	}
	await visit(directory);
	return { files, bytes };
}

async function countGeneratedEventRoutes(worktree) {
	const directory = path.join(worktree, ".next", "server", "app", "events");
	let articleHtml = 0;
	let playHtml = 0;
	let eventFiles = 0;
	async function visit(current) {
		let entries;
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch (error) {
			if (error?.code === "ENOENT") return;
			throw error;
		}
		for (const entry of entries) {
			const entryPath = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(entryPath);
			else if (entry.isFile()) {
				eventFiles += 1;
				const relative = path.relative(directory, entryPath);
				if (/^synthetic-event-\d{5}\.html$/.test(relative)) articleHtml += 1;
				if (/^synthetic-event-\d{5}[\\/]play\.html$/.test(relative)) {
					playHtml += 1;
				}
			}
		}
	}
	await visit(directory);
	return { articleHtml, playHtml, eventFiles };
}

async function measureHomePayload(worktree) {
	const serverApp = path.join(worktree, ".next", "server", "app");
	const files = ["index.html", "index.rsc", "index.meta"];
	const result = {};
	for (const name of files) {
		const metadata = await stat(path.join(serverApp, name)).catch(() => null);
		result[name] = metadata?.size ?? null;
	}
	return result;
}

function parseWranglerUpload(output) {
	const match = /Total Upload:\s+([\d.]+) KiB\s+\/ gzip:\s+([\d.]+) KiB/.exec(
		output,
	);
	if (!match) return null;
	return {
		rawBytes: Math.round(Number(match[1]) * 1024),
		gzipBytes: Math.round(Number(match[2]) * 1024),
	};
}

function parseWranglerStartup(output) {
	const bundle = /Bundle:\s+([\d.]+) KiB\s+\/ gzip:\s+([\d.]+) KiB/.exec(
		output,
	);
	const profileWindow = /Profile window:\s+([\d.]+) ms/.exec(output);
	const sampled = /Sampled time:\s+([\d.]+) ms/.exec(output);
	const active = /Active:\s+([\d.]+) ms/.exec(output);
	const idle = /Idle:\s+([\d.]+) ms/.exec(output);
	const samples = /Samples:\s+(\d+)/.exec(output);
	if (!bundle || !profileWindow || !sampled || !active || !idle || !samples) {
		return null;
	}
	return {
		bundleRawBytes: Math.round(Number(bundle[1]) * 1024),
		bundleGzipBytes: Math.round(Number(bundle[2]) * 1024),
		profileWindowMs: Number(profileWindow[1]),
		sampledMs: Number(sampled[1]),
		activeMs: Number(active[1]),
		idleMs: Number(idle[1]),
		samples: Number(samples[1]),
		localProfileOnly: true,
	};
}

function parseLastJsonLine(output) {
	for (const line of output.trim().split("\n").reverse()) {
		try {
			return JSON.parse(line);
		} catch {
			// Continue until the last machine-readable line is found.
		}
	}
	return null;
}

function assertSyntheticIndex(index) {
	if (!Number.isSafeInteger(index) || index < 0 || index >= 99_999) {
		throw new Error("Synthetic event index must be between 0 and 99,998");
	}
}

function assertEventCount(eventCount) {
	if (
		!Number.isSafeInteger(eventCount) ||
		eventCount < 1 ||
		eventCount > 99_999
	) {
		throw new Error("Event count must be between 1 and 99,999");
	}
}

function assertTimeout(timeoutMs) {
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000) {
		throw new Error("Benchmark timeout must be at least 1,000 ms");
	}
}

function parseArguments(argv) {
	const options = {
		eventCount: defaultEventCount,
		includeCurrentBuild: true,
		keepWorktree: false,
		outputPath: undefined,
		timeoutMs: defaultTimeoutMs,
	};
	for (const argument of argv) {
		if (argument === "--skip-current-build")
			options.includeCurrentBuild = false;
		else if (argument === "--keep-worktree") options.keepWorktree = true;
		else if (argument.startsWith("--count=")) {
			options.eventCount = Number(argument.slice("--count=".length));
		} else if (argument.startsWith("--output=")) {
			options.outputPath = path.resolve(argument.slice("--output=".length));
		} else if (argument.startsWith("--timeout-ms=")) {
			options.timeoutMs = Number(argument.slice("--timeout-ms=".length));
		} else {
			throw new Error(`Unknown benchmark argument: ${argument}`);
		}
	}
	assertEventCount(options.eventCount);
	assertTimeout(options.timeoutMs);
	return options;
}

const isMain =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	const options = parseArguments(process.argv.slice(2));
	const abortController = new AbortController();
	let receivedSignal = null;
	let mainFailure = null;
	const handleSignal = (signal) => {
		receivedSignal = signal;
		abortController.abort(new Error(`Benchmark interrupted by ${signal}`));
		cancelActiveCommands();
	};
	const handleInterrupt = () => handleSignal("SIGINT");
	const handleTermination = () => handleSignal("SIGTERM");
	process.once("SIGINT", handleInterrupt);
	process.once("SIGTERM", handleTermination);
	try {
		const { report } = await runArchitectureBenchmark({
			appRoot: process.cwd(),
			...options,
			signal: abortController.signal,
		});
		if (!report.gates.allRequiredPass) process.exitCode = 1;
	} catch (error) {
		mainFailure = error;
	} finally {
		process.off("SIGINT", handleInterrupt);
		process.off("SIGTERM", handleTermination);
	}
	if (receivedSignal) {
		process.exitCode = receivedSignal === "SIGINT" ? 130 : 143;
	} else if (mainFailure) {
		throw mainFailure;
	}
}
