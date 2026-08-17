import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
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
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import {
	generateReleaseArtifacts,
	resolveCleanGitCheckout,
} from "../scripts/generate-release-artifacts";
import { interactiveBeatSchema } from "../src/lib/content/event";
import {
	type Event,
	parseEventDocument,
	serializeEventDocument,
} from "../src/lib/content/event-document";
import {
	assertProjectedStaticAssetBudget,
	assertSearchArtifactBudgets,
	createReleaseArtifacts,
	loadReleaseEvents,
	projectPublicEvent,
	RELEASE_ARTIFACT_SCHEMA_VERSION,
	RELEASE_LIMITS,
	selectPublicReleaseFiles,
	serializeJsonForHtml,
	writeReleaseArtifacts,
} from "../src/lib/content/release-artifacts";
import { stagePublicRelease } from "../src/lib/content/release-public-stage";
import { beatSources, voteRevoteBeat } from "./fixtures/interactive-beat";

const execute = promisify(execFile);
const appSha = "a".repeat(40);
const contentSha = "b".repeat(40);

function event(slug: string, overrides: Partial<Event> = {}): Event {
	return {
		slug,
		title: `Event ${slug}`,
		date: { year: 1900, era: "ce", precision: "day", month: 6, day: 1 },
		summary: "Korte samenvatting",
		body: "Canonieke Markdowntekst.",
		topics: ["geschiedenis"],
		topicLabels: { geschiedenis: "Geschiedenis" },
		profiles: ["algemeen"],
		sources: [
			{
				title: "Primaire bron",
				publisher: "Archief",
				url: `https://example.org/${slug}`,
			},
		],
		...overrides,
	};
}

function requireFile(
	release: { files: Map<string, Uint8Array> },
	relativePath: string,
): Uint8Array {
	const file = release.files.get(relativePath);
	if (!file) throw new Error(`Missing generated file ${relativePath}`);
	return file;
}

function decode(file: Uint8Array): string {
	return new TextDecoder().decode(file);
}

async function initializeGitRepository(root: string): Promise<string> {
	await execute("git", ["init", "-q", "-b", "main"], { cwd: root });
	await execute("git", ["config", "user.name", "Test"], { cwd: root });
	await execute("git", ["config", "user.email", "test@example.com"], {
		cwd: root,
	});
	await execute("git", ["add", "."], { cwd: root });
	await execute("git", ["commit", "-qm", "fixture"], { cwd: root });
	const { stdout } = await execute("git", ["rev-parse", "HEAD"], { cwd: root });
	return stdout.trim();
}

describe("release artifact contract", () => {
	it("shares one hashed Beat V2 parity fixture with the content schema", async () => {
		const document = await readFile(
			path.join(process.cwd(), "tests/fixtures/release-parity-event.md"),
			"utf8",
		);
		expect(createHash("sha256").update(document).digest("hex")).toBe(
			"b0d2817528fda7d084b3a1414814ec9bc975ac4aeca143769af0aae5a1179fb3",
		);
		expect(
			parseEventDocument("release-parity-event-1969", document),
		).toMatchObject({ beat: { version: 2, responseMethod: "response-cards" } });
	});

	it("projects canonical events through an explicit public allowlist", () => {
		const source = {
			...event("apollo-11-1969", {
				sources: beatSources.map((item) => ({ ...item })),
				beat: interactiveBeatSchema.parse(voteRevoteBeat),
			}),
			aiReview: { acceptedClaims: ["must never leak"] },
			internalNotes: "must never leak",
		} as Event & Record<string, unknown>;

		const projected = projectPublicEvent(source);
		const serialized = JSON.stringify(projected);

		expect(projected).toMatchObject({
			slug: "apollo-11-1969",
			beat: { mechanic: "vote-revote" },
			mediaId: "apollo-11-aldrin",
		});
		expect(serialized).not.toContain("aiReview");
		expect(serialized).not.toContain("internalNotes");
	});

	it("emits a deterministic build-only media registry", () => {
		const release = createReleaseArtifacts([event("apollo-11-1969")], {
			appSha,
			contentSha,
		});
		const prefix = `releases/${release.releaseId}`;
		const media = JSON.parse(
			decode(requireFile(release, `${prefix}/media.json`)),
		);
		const manifest = JSON.parse(
			decode(requireFile(release, `${prefix}/manifest.json`)),
		);

		expect(media.media).toEqual([
			expect.objectContaining({
				id: "apollo-11-aldrin",
				renditions: [
					expect.objectContaining({
						path: "/media/assets/2d514da09e22846759e1552189646ee456a973fa641399599875dc10bae7c5cb.webp",
					}),
				],
			}),
		]);
		expect(JSON.stringify(media)).not.toContain("sourcePath");
		expect(JSON.stringify(media)).not.toContain("media/sources");
		expect(manifest.artifacts).toContainEqual(
			expect.objectContaining({
				path: `${prefix}/media.json`,
				role: "media",
				delivery: "build-only",
			}),
		);
		const publicFiles = selectPublicReleaseFiles(release);
		expect([...publicFiles.keys()]).toEqual([
			`${prefix}/facets.json`,
			`${prefix}/search.json`,
		]);
		expect(
			[...publicFiles.keys()].some((name) => name.includes("/events/")),
		).toBe(false);
		const eventPath = [...release.files.keys()].find((name) =>
			name.includes("/events/"),
		);
		if (!eventPath) throw new Error("Expected build-only event artifact");
		release.delivery.set(eventPath, "public");
		expect(() => selectPublicReleaseFiles(release)).toThrow(
			"Unexpected public release artifact",
		);
	});

	it("emits byte-identical versioned files with verified checksums", () => {
		const events = [event("beta"), event("alpha")];
		const first = createReleaseArtifacts(events, { appSha, contentSha });
		const second = createReleaseArtifacts([...events].reverse(), {
			appSha,
			contentSha,
		});

		expect(second.releaseId).toBe(first.releaseId);
		expect([...second.files]).toEqual([...first.files]);
		expect([...first.files.keys()]).toEqual([
			"release.json",
			`releases/${first.releaseId}/events/alpha.json`,
			`releases/${first.releaseId}/events/beta.json`,
			`releases/${first.releaseId}/facets.json`,
			`releases/${first.releaseId}/manifest.json`,
			`releases/${first.releaseId}/media.json`,
			`releases/${first.releaseId}/search.json`,
		]);

		const pointer = JSON.parse(decode(requireFile(first, "release.json")));
		const manifestPath = `releases/${first.releaseId}/manifest.json`;
		const manifestBytes = requireFile(first, manifestPath);
		expect(pointer).toEqual({
			schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
			releaseId: first.releaseId,
			manifestPath,
			manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
		});
		expect(decode(manifestBytes)).not.toContain("generatedAt");
	});

	it("fails closed on duplicate identities, conflicting labels, and oversized fields", () => {
		expect(() =>
			createReleaseArtifacts([event("same"), event("same")], {
				appSha,
				contentSha,
			}),
		).toThrow("Duplicate event slug");
		expect(() =>
			createReleaseArtifacts(
				[
					event("first"),
					event("second", {
						topicLabels: { geschiedenis: "Andere naam" },
					}),
				],
				{ appSha, contentSha },
			),
		).toThrow("Conflicting topic label");
		expect(() =>
			createReleaseArtifacts([event("large", { body: "x".repeat(20_001) })], {
				appSha,
				contentSha,
			}),
		).toThrow("body");
		expect(() =>
			createReleaseArtifacts([event("valid")], {
				appSha: "main",
				contentSha,
			}),
		).toThrow("40-character lowercase hexadecimal SHA");
	});

	it("requires a clean application revision", async () => {
		const cleanGit = vi.fn(async (arguments_: string[], cwd: string) => {
			if (arguments_[1] === "--show-toplevel") return `${cwd}\n`;
			return arguments_[0] === "rev-parse" ? `${appSha}\n` : "";
		});
		await expect(
			resolveCleanGitCheckout("/app", "Application", cleanGit),
		).resolves.toEqual({ sha: appSha, topLevel: "/app" });
		const dirtyGit = vi.fn(async (arguments_: string[], cwd: string) => {
			if (arguments_[1] === "--show-toplevel") return `${cwd}\n`;
			return arguments_[0] === "rev-parse"
				? `${appSha}\n`
				: " M package.json\n";
		});
		await expect(
			resolveCleanGitCheckout("/app", "Application", dirtyGit),
		).rejects.toThrow("Dirty application checkout");
		await expect(
			resolveCleanGitCheckout("/content", "Content", dirtyGit),
		).rejects.toThrow("Dirty content checkout");
	});

	it("binds projected bytes to clean app and content Git revisions", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-git-"));
		const appRoot = path.join(root, "app");
		const contentRoot = path.join(root, "content-repository");
		await mkdir(appRoot);
		await mkdir(path.join(contentRoot, "content/events"), { recursive: true });
		await writeFile(path.join(appRoot, ".gitignore"), "/.generated/\n");
		const contentPath = path.join(
			contentRoot,
			"content/events/single-event.md",
		);
		const originalDocument = serializeEventDocument(event("single-event"));
		await writeFile(contentPath, originalDocument);
		const cleanAppSha = await initializeGitRepository(appRoot);
		const cleanContentSha = await initializeGitRepository(contentRoot);
		await expect(
			generateReleaseArtifacts({ appRoot, contentRoot: appRoot }),
		).rejects.toThrow("distinct Git checkouts");
		await expect(
			generateReleaseArtifacts({
				appRoot,
				contentRoot,
				outputDirectory: path.join(contentRoot, "generated"),
			}),
		).rejects.toThrow("inside application .generated");
		let mutatedDuringResolution = false;
		const mutatingRunGit = async (arguments_: string[], cwd: string) => {
			const { stdout } = await execute("git", arguments_, { cwd });
			if (
				cwd === contentRoot &&
				arguments_[0] === "status" &&
				!mutatedDuringResolution
			) {
				mutatedDuringResolution = true;
				await writeFile(
					contentPath,
					serializeEventDocument(
						event("single-event", { summary: "Gewijzigd" }),
					),
				);
			}
			return stdout;
		};

		const release = await generateReleaseArtifacts({
			appRoot,
			contentRoot,
			runGit: mutatingRunGit,
		});
		expect(release).toMatchObject({
			appSha: cleanAppSha,
			contentSha: cleanContentSha,
			publicFileCount: 2,
		});
		const eventPath = [...release.files.keys()].find((name) =>
			name.endsWith("/events/single-event.json"),
		);
		if (!eventPath) throw new Error("Missing projected event");
		const projected = JSON.parse(decode(requireFile(release, eventPath)));
		expect(projected.event.summary).toBe("Korte samenvatting");
		await expect(
			generateReleaseArtifacts({ appRoot, contentRoot }),
		).rejects.toThrow("Dirty content checkout");
	});

	it("rejects a committed content event-root symlink", async () => {
		const root = await mkdtemp(
			path.join(tmpdir(), "toen-release-archive-link-"),
		);
		const appRoot = path.join(root, "app");
		const contentRoot = path.join(root, "content-repository");
		const externalEvents = path.join(root, "external-events");
		await mkdir(appRoot);
		await mkdir(path.join(contentRoot, "content"), { recursive: true });
		await mkdir(externalEvents);
		await writeFile(path.join(appRoot, ".gitignore"), "/.generated/\n");
		await writeFile(
			path.join(externalEvents, "single-event.md"),
			serializeEventDocument(event("single-event")),
		);
		await symlink(
			externalEvents,
			path.join(contentRoot, "content/events"),
			"dir",
		);
		await initializeGitRepository(appRoot);
		await initializeGitRepository(contentRoot);

		await expect(
			generateReleaseArtifacts({ appRoot, contentRoot }),
		).rejects.toThrow("snapshot event root must be a real directory");
	});

	it("enforces no-domain Static Assets headroom before generation", () => {
		expect(
			assertProjectedStaticAssetBudget({
				events: 5_000,
				media: 5_000,
				topics: 256,
			}),
		).toBe(15_409);
		expect(() =>
			assertProjectedStaticAssetBudget({
				events: 6_000,
				media: 6_000,
				topics: 256,
			}),
		).toThrow("18000-file CI hard stop");
		expect(() =>
			assertProjectedStaticAssetBudget({
				events: 6_300,
				media: 5_000,
				topics: 256,
			}),
		).toThrow("Projected public output 18009");
	});

	it("rejects unsupported Markdown and oversized compressed search", () => {
		expect(() =>
			createReleaseArtifacts(
				[event("unsafe-markdown", { body: "<script>alert(1)</script>" })],
				{ appSha, contentSha },
			),
		).toThrow("unsupported Markdown");
		let state = 1;
		const bytes = Uint8Array.from(
			{ length: RELEASE_LIMITS.searchBrotliBytes + 100 },
			() => {
				state = (state * 1_664_525 + 1_013_904_223) >>> 0;
				return (state >>> 24) & 0xff;
			},
		);
		expect(() => assertSearchArtifactBudgets(bytes)).toThrow("Brotli bytes");
	});

	it("escapes JSON before embedding it inside HTML", () => {
		const serialized = serializeJsonForHtml({
			value: "</script><script>alert('x')</script>&\u2028\u2029",
		});

		expect(serialized).not.toContain("<");
		expect(serialized).not.toContain(">");
		expect(serialized).not.toContain("&");
		expect(serialized).not.toContain("\u2028");
		expect(serialized).not.toContain("\u2029");
		expect(JSON.parse(serialized)).toEqual({
			value: "</script><script>alert('x')</script>&\u2028\u2029",
		});
	});

	it("bounds concurrent document reads", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-load-"));
		const eventsDirectory = path.join(root, "events");
		await mkdir(eventsDirectory);
		for (let index = 0; index < 12; index += 1) {
			const slug = `event-${String(index + 1).padStart(2, "0")}`;
			await writeFile(
				path.join(eventsDirectory, `${slug}.md`),
				serializeEventDocument(event(slug)),
			);
		}
		let active = 0;
		let maximumActive = 0;
		const loaded = await loadReleaseEvents(eventsDirectory, {
			concurrency: 3,
			readDocument: async (filePath) => {
				active += 1;
				maximumActive = Math.max(maximumActive, active);
				await new Promise((resolve) => setTimeout(resolve, 5));
				try {
					return await readFile(filePath, "utf8");
				} finally {
					active -= 1;
				}
			},
		});

		expect(loaded).toHaveLength(12);
		expect(maximumActive).toBe(3);
	});

	it("rejects symlink aliases that overlap canonical content", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-symlink-"));
		const eventsDirectory = path.join(root, "events");
		const eventsAlias = path.join(root, "events-alias");
		await mkdir(eventsDirectory);
		await writeFile(
			path.join(eventsDirectory, "single-event.md"),
			serializeEventDocument(event("single-event")),
		);
		await symlink(eventsDirectory, eventsAlias, "dir");

		await expect(
			writeReleaseArtifacts({
				eventsDirectory: eventsAlias,
				outputDirectory: path.join(eventsDirectory, "generated"),
				appSha,
				contentSha,
			}),
		).rejects.toThrow("separate from canonical content");
		const outputDirectory = path.join(root, "safe-output");
		await mkdir(outputDirectory);
		await symlink(
			eventsDirectory,
			path.join(outputDirectory, "releases"),
			"dir",
		);
		await expect(
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory,
				appSha,
				contentSha,
			}),
		).rejects.toThrow("real directory");
	});

	it("stages only checksum-verified public discovery artifacts", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-stage-"));
		const eventsDirectory = path.join(root, "events");
		const releaseDirectory = path.join(root, "release");
		const publicDirectory = path.join(root, "public");
		const generatedDirectory = path.join(root, "generated");
		await mkdir(eventsDirectory);
		await writeFile(
			path.join(eventsDirectory, "stage-event.md"),
			serializeEventDocument(event("stage-event")),
		);
		const release = await writeReleaseArtifacts({
			eventsDirectory,
			outputDirectory: releaseDirectory,
			appSha,
			contentSha,
		});

		await expect(
			stagePublicRelease({
				releaseDirectory,
				publicDirectory,
				generatedDirectory,
			}),
		).resolves.toMatchObject({ releaseId: release.releaseId, fileCount: 2 });
		await expect(
			readFile(
				path.join(
					publicDirectory,
					"releases",
					release.releaseId,
					"search.json",
				),
			),
		).resolves.toBeInstanceOf(Buffer);
		const pointer = JSON.parse(
			await readFile(path.join(generatedDirectory, "discovery.json"), "utf8"),
		);
		expect(pointer).toEqual({
			schemaVersion: 1,
			releaseId: release.releaseId,
			searchIndexUrl: `/releases/${release.releaseId}/search.json`,
			facetsUrl: `/releases/${release.releaseId}/facets.json`,
			development: false,
		});
		await writeFile(
			path.join(releaseDirectory, "releases", release.releaseId, "search.json"),
			"tampered",
		);
		await expect(
			stagePublicRelease({
				releaseDirectory,
				publicDirectory,
				generatedDirectory,
			}),
		).rejects.toThrow("checksum");
	});

	it("keeps new release active when obsolete backup cleanup fails", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-cleanup-"));
		const eventsDirectory = path.join(root, "events");
		const releaseDirectory = path.join(root, "release");
		const publicDirectory = path.join(root, "public");
		const generatedDirectory = path.join(root, "generated");
		await mkdir(eventsDirectory);
		await writeFile(
			path.join(eventsDirectory, "cleanup-event.md"),
			serializeEventDocument(event("cleanup-event")),
		);
		const first = await writeReleaseArtifacts({
			eventsDirectory,
			outputDirectory: releaseDirectory,
			appSha,
			contentSha,
		});
		await stagePublicRelease({
			releaseDirectory,
			publicDirectory,
			generatedDirectory,
		});
		const second = await writeReleaseArtifacts({
			eventsDirectory,
			outputDirectory: releaseDirectory,
			appSha: "c".repeat(40),
			contentSha,
		});
		const warning = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		try {
			await expect(
				stagePublicRelease({
					releaseDirectory,
					publicDirectory,
					generatedDirectory,
					removePath: async (target, options) => {
						if (String(target).includes(".public-releases-backup-")) {
							throw new Error("injected cleanup failure");
						}
						await rm(target, options);
					},
				}),
			).resolves.toMatchObject({ releaseId: second.releaseId });
		} finally {
			warning.mockRestore();
		}
		const pointer = JSON.parse(
			await readFile(path.join(generatedDirectory, "discovery.json"), "utf8"),
		);
		expect(pointer.releaseId).toBe(second.releaseId);
		await expect(
			readFile(
				path.join(publicDirectory, "releases", second.releaseId, "search.json"),
			),
		).resolves.toBeInstanceOf(Buffer);
		await expect(
			readFile(
				path.join(publicDirectory, "releases", first.releaseId, "search.json"),
			),
		).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("rejects symlinked public release roots", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-link-"));
		const eventsDirectory = path.join(root, "events");
		const releaseDirectory = path.join(root, "release");
		await mkdir(eventsDirectory);
		await writeFile(
			path.join(eventsDirectory, "linked-event.md"),
			serializeEventDocument(event("linked-event")),
		);
		await writeReleaseArtifacts({
			eventsDirectory,
			outputDirectory: releaseDirectory,
			appSha,
			contentSha,
		});
		const realPublic = path.join(root, "real-public");
		await mkdir(realPublic);
		const linkedPublic = path.join(root, "linked-public");
		await symlink(realPublic, linkedPublic, "dir");
		await expect(
			stagePublicRelease({
				releaseDirectory,
				publicDirectory: linkedPublic,
				generatedDirectory: path.join(root, "generated"),
			}),
		).rejects.toThrow("Public release directory must be a real directory");

		const publicDirectory = path.join(root, "public");
		const externalReleases = path.join(root, "external-releases");
		await mkdir(publicDirectory);
		await mkdir(externalReleases);
		await symlink(
			externalReleases,
			path.join(publicDirectory, "releases"),
			"dir",
		);
		await expect(
			stagePublicRelease({
				releaseDirectory,
				publicDirectory,
				generatedDirectory: path.join(root, "generated"),
			}),
		).rejects.toThrow(
			"Active public releases directory must be a real directory",
		);
	});

	it("rejects live and stale locks without corrupting concurrent output", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-lock-"));
		const eventsDirectory = path.join(root, "events");
		const outputDirectory = path.join(root, "output");
		const lockPath = `${outputDirectory}.lock`;
		await mkdir(eventsDirectory);
		await writeFile(
			path.join(eventsDirectory, "single-event.md"),
			serializeEventDocument(event("single-event")),
		);
		await symlink(String(process.pid), lockPath);
		await expect(
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory,
				appSha,
				contentSha,
			}),
		).rejects.toThrow("locked by process");
		await rm(lockPath);
		await symlink("2147483647-stale", lockPath);
		await expect(
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory,
				appSha,
				contentSha,
			}),
		).rejects.toThrow("stale lock");
		await rm(lockPath);
		const outcomes = await Promise.allSettled([
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory,
				appSha,
				contentSha,
			}),
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory,
				appSha,
				contentSha,
			}),
		]);
		expect(outcomes.some(({ status }) => status === "fulfilled")).toBe(true);
		const pointer = JSON.parse(
			await readFile(path.join(outputDirectory, "release.json"), "utf8"),
		);
		await expect(
			readFile(path.join(outputDirectory, pointer.manifestPath)),
		).resolves.toBeInstanceOf(Buffer);
	});

	it("writes deterministic output outside canonical content", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-release-write-"));
		const eventsDirectory = path.join(root, "canonical-events");
		const firstOutput = path.join(root, "first-output");
		const secondOutput = path.join(root, "second-output");
		await mkdir(eventsDirectory);
		await writeFile(
			path.join(eventsDirectory, "single-event.md"),
			serializeEventDocument(event("single-event")),
		);

		const first = await writeReleaseArtifacts({
			eventsDirectory,
			outputDirectory: firstOutput,
			appSha,
			contentSha,
		});
		const second = await writeReleaseArtifacts({
			eventsDirectory,
			outputDirectory: secondOutput,
			appSha,
			contentSha,
		});

		expect(second.releaseId).toBe(first.releaseId);
		for (const [relativePath, bytes] of first.files) {
			await expect(
				readFile(path.join(secondOutput, relativePath)),
			).resolves.toEqual(Buffer.from(bytes));
		}
		const pointerBeforeFailure = await readFile(
			path.join(secondOutput, "release.json"),
		);
		const eventArtifact = [...second.files.keys()].find((name) =>
			name.includes("/events/"),
		);
		if (!eventArtifact) throw new Error("Expected event artifact");
		await writeFile(path.join(secondOutput, eventArtifact), "corrupt");
		await expect(
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory: secondOutput,
				appSha,
				contentSha,
			}),
		).rejects.toThrow("differs from projection");
		await expect(
			readFile(path.join(secondOutput, "release.json")),
		).resolves.toEqual(pointerBeforeFailure);
		await expect(
			readFile(path.join(eventsDirectory, "single-event.md"), "utf8"),
		).resolves.toBe(serializeEventDocument(event("single-event")));
		await expect(
			writeReleaseArtifacts({
				eventsDirectory,
				outputDirectory: eventsDirectory,
				appSha,
				contentSha,
			}),
		).rejects.toThrow("separate from canonical content");
	});
});
