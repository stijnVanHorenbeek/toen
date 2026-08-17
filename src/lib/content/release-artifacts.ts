import { createHash, randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	readdir,
	readFile,
	readlink,
	realpath,
	rename,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";
import { formatEventTag } from "../i18n/locale";
import { isSupportedEditorMarkdown } from "./editor-markdown";
import type { HistoricalDate, InteractiveBeat } from "./event";
import { type Event, isEventSlug, parseEventDocument } from "./event-document";
import {
	getEventVisual,
	getEventVisualId,
	type HistoricalVisual,
	historicalVisuals,
} from "./event-media";
import { createEventSearchArtifact } from "./search-artifact";

export const RELEASE_ARTIFACT_SCHEMA_VERSION = 1 as const;

export const STATIC_ASSET_CI_HARD_STOP = 18_000;
const staticArchiveIndexFiles = 1;
const staticPeriodArchiveFiles = 24;
const staticSharedAssetAllowance = 128;

export const RELEASE_LIMITS = {
	events: 10_000,
	rawDocumentBytes: 65_536,
	titleCharacters: 160,
	summaryCharacters: 500,
	bodyCharacters: 20_000,
	topics: 16,
	profiles: 16,
	sources: 16,
	sourceTitleCharacters: 240,
	sourcePublisherCharacters: 160,
	sourceUrlCharacters: 2_048,
	topicLabelCharacters: 120,
	eventJsonBytes: 131_072,
	searchJsonBytes: Math.floor(2.5 * 1024 ** 2),
	searchBrotliBytes: 750 * 1024,
	facetsJsonBytes: 256 * 1024,
	manifestJsonBytes: 2 * 1024 ** 2,
	mediaJsonBytes: 8 * 1024 ** 2,
	releasePointerJsonBytes: 4 * 1024,
	readConcurrency: 16,
	maximumReadConcurrency: 32,
} as const;

const immutableRevisionPattern = /^[0-9a-f]{40}$/;
const encoder = new TextEncoder();

type ArtifactDelivery = "build-only" | "public";
type ArtifactRole = "event" | "facets" | "media" | "search";

type JsonArtifact = {
	path: string;
	role: ArtifactRole;
	delivery: ArtifactDelivery;
	bytes: number;
	brotliBytes?: number;
	sha256: string;
};

export type PublicMediaRecord = {
	id: string;
	alt: string;
	caption: string;
	credit: string;
	license: string;
	licenseRationale: string;
	sourceUrl: string;
	originalUrl: string;
	derivative: string;
	focalPoint: string;
	renditions: Array<{
		path: string;
		format: "webp";
		width: number;
		height: number;
		sha256: string;
	}>;
};

export type PublicEvent = {
	slug: string;
	title: string;
	date: HistoricalDate;
	summary: string;
	body: string;
	topics: string[];
	topicLabels?: Record<string, string>;
	profiles: Event["profiles"];
	sources: Event["sources"];
	beat?: InteractiveBeat;
	mediaId?: string;
};

export type ReleaseArtifacts = {
	releaseId: string;
	files: Map<string, Uint8Array>;
	delivery: Map<string, ArtifactDelivery>;
};

export type LoadReleaseEventsOptions = {
	concurrency?: number;
	readDocument?: (filePath: string) => Promise<string>;
};

export function projectPublicEvent(event: Event): PublicEvent {
	validateEventBounds(event);
	return projectPublicEventUnchecked(event);
}

function projectPublicEventUnchecked(event: Event): PublicEvent {
	const mediaId = getEventVisualId(event.slug);
	return {
		slug: event.slug,
		title: event.title,
		date: projectHistoricalDate(event.date),
		summary: event.summary,
		body: event.body,
		topics: [...event.topics],
		...(event.topicLabels
			? { topicLabels: sortRecord(event.topicLabels) }
			: {}),
		profiles: [...event.profiles],
		sources: event.sources.map(({ title, publisher, url }) => ({
			title,
			publisher,
			url,
		})),
		...(event.beat ? { beat: projectPublicBeat(event.beat) } : {}),
		...(mediaId ? { mediaId } : {}),
	};
}

export function createReleaseArtifacts(
	events: Event[],
	{ appSha, contentSha }: { appSha: string; contentSha: string },
): ReleaseArtifacts {
	assertImmutableRevision(appSha, "Application");
	assertImmutableRevision(contentSha, "Content");
	if (events.length === 0)
		throw new Error("Release requires at least one event");
	if (events.length > RELEASE_LIMITS.events) {
		throw new Error(`Release exceeds ${RELEASE_LIMITS.events} events`);
	}

	const sortedEvents = [...events].sort((left, right) =>
		compareAscii(left.slug, right.slug),
	);
	validateCatalogIdentity(sortedEvents);
	const releaseId = createReleaseId(appSha, contentSha);
	const topicLabels = collectStrictTopicLabels(sortedEvents);
	const prefix = `releases/${releaseId}`;
	const contentFiles = new Map<string, Uint8Array>();
	const publicEvents = sortedEvents.map(projectPublicEventUnchecked);

	for (const event of publicEvents) {
		const relativePath = `${prefix}/events/${event.slug}.json`;
		contentFiles.set(
			relativePath,
			encodeJson(
				{
					schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
					releaseId,
					event,
				},
				RELEASE_LIMITS.eventJsonBytes,
				relativePath,
			),
		);
	}

	const facetsPath = `${prefix}/facets.json`;
	contentFiles.set(
		facetsPath,
		encodeJson(
			createFacetsArtifact(publicEvents, topicLabels, releaseId),
			RELEASE_LIMITS.facetsJsonBytes,
			facetsPath,
		),
	);
	const mediaById = new Map<string, PublicMediaRecord>();
	for (const event of sortedEvents) {
		const id = getEventVisualId(event.slug);
		const visual = getEventVisual(event.slug);
		if (id && visual) mediaById.set(id, projectVisual(id, visual));
	}
	assertProjectedStaticAssetBudget({
		events: publicEvents.length,
		media: Object.keys(historicalVisuals).length,
		topics: Object.keys(topicLabels).length,
	});
	const mediaPath = `${prefix}/media.json`;
	contentFiles.set(
		mediaPath,
		encodeJson(
			{
				schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
				releaseId,
				media: [...mediaById.values()].sort((left, right) =>
					compareAscii(left.id, right.id),
				),
			},
			RELEASE_LIMITS.mediaJsonBytes,
			mediaPath,
		),
	);
	const searchPath = `${prefix}/search.json`;
	const searchBytes = encodeJson(
		createEventSearchArtifact(
			publicEvents.map((event) => ({
				slug: event.slug,
				title: event.title,
				date: event.date,
				summary: event.summary,
				topics: event.topics,
				...(event.topicLabels ? { topicLabels: event.topicLabels } : {}),
				...(event.beat
					? {
							activity: {
								mechanic: event.beat.mechanic,
								question: event.beat.question,
								durations: event.beat.routes.map(
									({ durationMinutes }) => durationMinutes,
								),
							},
						}
					: {}),
			})),
			{ topicLabels, releaseId },
		),
		RELEASE_LIMITS.searchJsonBytes,
		searchPath,
	);
	assertSearchArtifactBudgets(searchBytes, searchPath);
	contentFiles.set(searchPath, searchBytes);

	const artifacts = [...contentFiles]
		.map(([artifactPath, bytes]): JsonArtifact => {
			const role = artifactRole(artifactPath);
			return {
				path: artifactPath,
				role,
				delivery:
					role === "event" || role === "media" ? "build-only" : "public",
				bytes: bytes.byteLength,
				...(role === "search"
					? { brotliBytes: brotliCompressSync(bytes).byteLength }
					: {}),
				sha256: hashBytes(bytes),
			};
		})
		.sort((left, right) => compareAscii(left.path, right.path));
	const manifestPath = `${prefix}/manifest.json`;
	const manifestBytes = encodeJson(
		{
			kind: "content-projection",
			schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
			releaseId,
			appSha,
			contentSha,
			counts: {
				events: publicEvents.length,
				interactiveEvents: publicEvents.filter(({ beat }) => Boolean(beat))
					.length,
				mediaReferences: publicEvents.filter(({ mediaId }) => Boolean(mediaId))
					.length,
				mediaObjects: mediaById.size,
				topics: Object.keys(topicLabels).length,
			},
			artifacts,
		},
		RELEASE_LIMITS.manifestJsonBytes,
		manifestPath,
	);
	const pointerBytes = encodeJson(
		{
			schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
			releaseId,
			manifestPath,
			manifestSha256: hashBytes(manifestBytes),
		},
		RELEASE_LIMITS.releasePointerJsonBytes,
		"release.json",
	);
	const files = new Map<string, Uint8Array>([["release.json", pointerBytes]]);
	for (const [artifactPath, bytes] of [
		...contentFiles,
		[manifestPath, manifestBytes] as const,
	].sort(([left], [right]) => compareAscii(left, right))) {
		files.set(artifactPath, bytes);
	}
	const delivery = new Map<string, ArtifactDelivery>([
		["release.json", "build-only"],
		[manifestPath, "build-only"],
	]);
	for (const artifact of artifacts) {
		delivery.set(artifact.path, artifact.delivery);
	}
	return { releaseId, files, delivery };
}

export function selectPublicReleaseFiles(
	release: ReleaseArtifacts,
): Map<string, Uint8Array> {
	const allowedPaths = new Set([
		`releases/${release.releaseId}/facets.json`,
		`releases/${release.releaseId}/search.json`,
	]);
	for (const [relativePath, delivery] of release.delivery) {
		if (delivery === "public" && !allowedPaths.has(relativePath)) {
			throw new Error(`Unexpected public release artifact: ${relativePath}`);
		}
	}
	const selected = new Map<string, Uint8Array>();
	for (const relativePath of [...allowedPaths].sort(compareAscii)) {
		const bytes = release.files.get(relativePath);
		if (!bytes)
			throw new Error(`Missing public release artifact: ${relativePath}`);
		selected.set(relativePath, bytes);
	}
	return selected;
}

export async function loadReleaseEvents(
	eventsDirectory: string,
	{
		concurrency = RELEASE_LIMITS.readConcurrency,
		readDocument = (filePath) => readFile(filePath, "utf8"),
	}: LoadReleaseEventsOptions = {},
): Promise<Event[]> {
	const rootMetadata = await lstat(eventsDirectory);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
		throw new Error("Release event directory must be a real directory");
	}
	if (
		!Number.isSafeInteger(concurrency) ||
		concurrency < 1 ||
		concurrency > RELEASE_LIMITS.maximumReadConcurrency
	) {
		throw new Error(
			`Read concurrency must be between 1 and ${RELEASE_LIMITS.maximumReadConcurrency}`,
		);
	}
	const entries = await readdir(eventsDirectory, { withFileTypes: true });
	if (entries.length === 0)
		throw new Error("Release requires at least one event");
	if (entries.length > RELEASE_LIMITS.events) {
		throw new Error(`Release exceeds ${RELEASE_LIMITS.events} events`);
	}
	const filenames = entries
		.map((entry) => {
			if (!entry.isFile() || !entry.name.endsWith(".md")) {
				throw new Error(`Invalid event catalog entry: ${entry.name}`);
			}
			const slug = entry.name.slice(0, -3);
			if (!isEventSlug(slug)) {
				throw new Error(`Invalid event filename: ${entry.name}`);
			}
			return entry.name;
		})
		.sort(compareAscii);
	const events = new Array<Event>(filenames.length);
	await mapBounded(filenames, concurrency, async (filename, index) => {
		const filePath = path.join(eventsDirectory, filename);
		const metadata = await stat(filePath);
		if (!metadata.isFile() || metadata.size > RELEASE_LIMITS.rawDocumentBytes) {
			throw new Error(
				`Event document ${filename} exceeds ${RELEASE_LIMITS.rawDocumentBytes} bytes`,
			);
		}
		const document = await readDocument(filePath);
		if (encoder.encode(document).byteLength > RELEASE_LIMITS.rawDocumentBytes) {
			throw new Error(
				`Event document ${filename} exceeds ${RELEASE_LIMITS.rawDocumentBytes} bytes`,
			);
		}
		events[index] = parseEventDocument(filename.slice(0, -3), document);
	});
	validateCatalogIdentity(events);
	return events;
}

export async function writeReleaseArtifacts({
	eventsDirectory,
	outputDirectory,
	appSha,
	contentSha,
	concurrency = RELEASE_LIMITS.readConcurrency,
}: {
	eventsDirectory: string;
	outputDirectory: string;
	appSha: string;
	contentSha: string;
	concurrency?: number;
}): Promise<ReleaseArtifacts> {
	await assertSeparateTrees(eventsDirectory, outputDirectory);
	const events = await loadReleaseEvents(eventsDirectory, { concurrency });
	const release = createReleaseArtifacts(events, { appSha, contentSha });
	const output = path.resolve(outputDirectory);
	const parent = path.dirname(output);
	const staged = path.join(parent, `.release-${randomUUID()}`);
	const lockPath = `${output}.lock`;
	await mkdir(parent, { recursive: true });
	await mkdir(staged);
	try {
		for (const [relativePath, bytes] of release.files) {
			const target = path.join(staged, relativePath);
			await mkdir(path.dirname(target), { recursive: true });
			await writeFile(target, bytes);
		}
		const releaseLock = await acquireReleaseLock(lockPath);
		try {
			const releasesDirectory = path.join(output, "releases");
			const targetRelease = path.join(releasesDirectory, release.releaseId);
			await assertDirectoryIsNotSymlink(output);
			await assertDirectoryIsNotSymlink(releasesDirectory);
			await mkdir(releasesDirectory, { recursive: true });
			await assertDirectoryIsNotSymlink(output);
			await assertDirectoryIsNotSymlink(releasesDirectory);
			if (await pathExists(targetRelease)) {
				await assertTreeHasNoSymlinks(targetRelease);
				await verifyInstalledRelease(output, release);
			} else {
				await rename(
					path.join(staged, "releases", release.releaseId),
					targetRelease,
				);
			}
			const pointerTemporary = path.join(
				output,
				`.release-pointer-${randomUUID()}`,
			);
			await writeFile(
				pointerTemporary,
				requireReleaseFile(release, "release.json"),
			);
			await rename(pointerTemporary, path.join(output, "release.json"));
			for (const entry of await readdir(releasesDirectory, {
				withFileTypes: true,
			})) {
				if (entry.name === release.releaseId) continue;
				await rm(path.join(releasesDirectory, entry.name), {
					recursive: true,
					force: true,
				});
			}
			for (const entry of await readdir(output)) {
				if (entry.startsWith(".release-pointer-")) {
					await rm(path.join(output, entry), { force: true });
				}
			}
		} finally {
			await releaseLock();
		}
	} finally {
		await rm(staged, { recursive: true, force: true });
	}
	return release;
}

async function assertDirectoryIsNotSymlink(target: string): Promise<void> {
	try {
		const metadata = await lstat(target);
		if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
			throw new Error(
				`Release output path must be a real directory: ${target}`,
			);
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
}

async function assertTreeHasNoSymlinks(target: string): Promise<void> {
	const metadata = await lstat(target);
	if (metadata.isSymbolicLink()) {
		throw new Error(`Release output tree contains symbolic link: ${target}`);
	}
	if (!metadata.isDirectory()) return;
	for (const entry of await readdir(target)) {
		await assertTreeHasNoSymlinks(path.join(target, entry));
	}
}

async function acquireReleaseLock(
	lockPath: string,
): Promise<() => Promise<void>> {
	const token = `${process.pid}-${randomUUID()}`;
	try {
		await symlink(token, lockPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		const owner = await readlink(lockPath);
		const ownerPid = Number(owner.split("-", 1)[0]);
		if (
			Number.isInteger(ownerPid) &&
			ownerPid > 0 &&
			isProcessRunning(ownerPid)
		) {
			throw new Error(`Release output is locked by process ${ownerPid}`);
		}
		throw new Error(
			`Release output has stale lock ${lockPath}; remove it after verifying no writer is active`,
		);
	}
	return async () => {
		const currentOwner = await readlink(lockPath).catch(() => null);
		if (currentOwner !== token) {
			throw new Error("Release output lock ownership changed unexpectedly");
		}
		await rm(lockPath, { force: true });
	};
}

function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

async function verifyInstalledRelease(
	outputDirectory: string,
	release: ReleaseArtifacts,
): Promise<void> {
	for (const [relativePath, expected] of release.files) {
		if (relativePath === "release.json") continue;
		let actual: Uint8Array;
		try {
			actual = await readFile(path.join(outputDirectory, relativePath));
		} catch {
			throw new Error(
				`Existing immutable release ${release.releaseId} is incomplete`,
			);
		}
		if (hashBytes(actual) !== hashBytes(expected)) {
			throw new Error(
				`Existing immutable release ${release.releaseId} differs from projection`,
			);
		}
	}
}

function requireReleaseFile(
	release: ReleaseArtifacts,
	relativePath: string,
): Uint8Array {
	const bytes = release.files.get(relativePath);
	if (!bytes) throw new Error(`Missing release file: ${relativePath}`);
	return bytes;
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
}

export function assertProjectedStaticAssetBudget({
	events,
	media,
	topics,
}: {
	events: number;
	media: number;
	topics: number;
}): number {
	for (const [label, value] of Object.entries({ events, media, topics })) {
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new Error(
				`Projected ${label} count must be a non-negative integer`,
			);
		}
	}
	const files =
		events * 2 +
		media +
		topics +
		staticArchiveIndexFiles +
		staticPeriodArchiveFiles +
		staticSharedAssetAllowance;
	if (files > STATIC_ASSET_CI_HARD_STOP) {
		throw new Error(
			`Projected public output ${files} exceeds ${STATIC_ASSET_CI_HARD_STOP}-file CI hard stop`,
		);
	}
	return files;
}

export function createReleaseId(appSha: string, contentSha: string): string {
	assertImmutableRevision(appSha, "Application");
	assertImmutableRevision(contentSha, "Content");
	return createHash("sha256")
		.update(
			`toen-release-v${RELEASE_ARTIFACT_SCHEMA_VERSION}\n${appSha}\n${contentSha}\n`,
		)
		.digest("hex");
}

export function assertSearchArtifactBudgets(
	bytes: Uint8Array,
	artifactPath = "search.json",
): void {
	if (bytes.byteLength > RELEASE_LIMITS.searchJsonBytes) {
		throw new Error(
			`Artifact ${artifactPath} exceeds ${RELEASE_LIMITS.searchJsonBytes} bytes (${bytes.byteLength})`,
		);
	}
	const brotliBytes = brotliCompressSync(bytes).byteLength;
	if (brotliBytes > RELEASE_LIMITS.searchBrotliBytes) {
		throw new Error(
			`Artifact ${artifactPath} exceeds ${RELEASE_LIMITS.searchBrotliBytes} Brotli bytes (${brotliBytes})`,
		);
	}
}

export function serializeJsonForHtml(value: unknown): string {
	return JSON.stringify(canonicalizeJson(value))
		.replaceAll("&", "\\u0026")
		.replaceAll("<", "\\u003c")
		.replaceAll(">", "\\u003e")
		.replaceAll("\u2028", "\\u2028")
		.replaceAll("\u2029", "\\u2029");
}

export function createFacetsArtifact(
	events: Array<Pick<PublicEvent, "date" | "topics">>,
	topicLabels: Record<string, string>,
	releaseId: string,
) {
	const counts = new Map<string, number>();
	const signedYears = events.map(({ date }) =>
		date.era === "bce" ? -date.year : date.year,
	);
	for (const event of events) {
		for (const topic of event.topics) {
			counts.set(topic, (counts.get(topic) ?? 0) + 1);
		}
	}
	return {
		schemaVersion: RELEASE_ARTIFACT_SCHEMA_VERSION,
		releaseId,
		yearRange: {
			minimum: Math.min(...signedYears),
			maximum: Math.max(...signedYears),
		},
		topics: [...counts]
			.sort(([left], [right]) => compareAscii(left, right))
			.map(([id, count]) => ({ id, label: topicLabels[id] ?? id, count })),
	};
}

function projectHistoricalDate(date: HistoricalDate): HistoricalDate {
	switch (date.precision) {
		case "day":
			return {
				year: date.year,
				era: date.era,
				precision: "day",
				month: date.month,
				day: date.day,
			};
		case "month":
			return {
				year: date.year,
				era: date.era,
				precision: "month",
				month: date.month,
			};
		case "approximate":
			return { year: date.year, era: date.era, precision: "approximate" };
		case "year":
			return { year: date.year, era: date.era, precision: "year" };
	}
}

function projectPublicBeat(beat: InteractiveBeat): InteractiveBeat {
	const shared = {
		question: beat.question,
		choices: beat.choices.map(({ id, label }) => ({ id, label })),
		stages: beat.stages.map(projectPublicStage),
		routes: beat.routes.map(({ durationMinutes, stageIds }) => ({
			durationMinutes,
			stageIds: [...stageIds],
		})) as InteractiveBeat["routes"],
		...(beat.sensitivityNotes
			? { sensitivityNotes: [...beat.sensitivityNotes] }
			: {}),
	};
	if (beat.version === 1) {
		switch (beat.mechanic) {
			case "vote-revote":
				return { version: 1, mechanic: "vote-revote", ...shared };
			case "source-duel":
				return {
					version: 1,
					mechanic: "source-duel",
					...shared,
					sourceCards: projectSourceCards(beat.sourceCards),
				};
			case "context-decision":
				return {
					version: 1,
					mechanic: "context-decision",
					...shared,
					perspective: beat.perspective,
				};
		}
	}
	const versionTwo = {
		version: 2 as const,
		responseMethod: beat.responseMethod,
		...(beat.vocationalConnection
			? { vocationalConnection: beat.vocationalConnection }
			: {}),
	};
	switch (beat.mechanic) {
		case "vote-revote":
			return { ...versionTwo, mechanic: "vote-revote", ...shared };
		case "source-duel":
			return {
				...versionTwo,
				mechanic: "source-duel",
				...shared,
				sourceCards: projectSourceCards(beat.sourceCards),
			};
		case "context-decision":
			return {
				...versionTwo,
				mechanic: "context-decision",
				...shared,
				perspective: beat.perspective,
			};
	}
}

function projectPublicStage(
	stage: InteractiveBeat["stages"][number],
): InteractiveBeat["stages"][number] {
	const common = {
		id: stage.id,
		suggestedSeconds: stage.suggestedSeconds,
		teacherPrompt: stage.teacherPrompt,
		expectedStudentAction: stage.expectedStudentAction,
	};
	switch (stage.phase) {
		case "opening":
			return { ...common, phase: "opening", stimulus: stage.stimulus };
		case "commitment":
			return { ...common, phase: "commitment", prompt: stage.prompt };
		case "evidence":
			return {
				...common,
				phase: "evidence",
				title: stage.title,
				evidence: stage.evidence,
				sourceUrl: stage.sourceUrl,
				earliestDurationMinutes: stage.earliestDurationMinutes,
				...(stage.optional ? { optional: true as const } : {}),
			};
		case "discussion":
			return {
				...common,
				phase: "discussion",
				prompt: stage.prompt,
				...(stage.sentenceStarter
					? { sentenceStarter: stage.sentenceStarter }
					: {}),
				...(stage.optional ? { optional: true as const } : {}),
			};
		case "revision":
			return { ...common, phase: "revision", prompt: stage.prompt };
		case "reasoning":
			return {
				...common,
				phase: "reasoning",
				prompt: stage.prompt,
				...(stage.optional ? { optional: true as const } : {}),
			};
		case "resolution":
			return {
				...common,
				phase: "resolution",
				title: stage.title,
				feedback: stage.feedback,
				...(stage.misconception ? { misconception: stage.misconception } : {}),
				sourceUrls: [...stage.sourceUrls],
			};
		case "lesson-bridge":
			return { ...common, phase: "lesson-bridge", bridge: stage.bridge };
	}
}

function projectSourceCards(
	cards: Extract<InteractiveBeat, { mechanic: "source-duel" }>["sourceCards"],
): Extract<InteractiveBeat, { mechanic: "source-duel" }>["sourceCards"] {
	return cards.map(({ id, label, excerpt, sourceUrl }) => ({
		id,
		label,
		excerpt,
		sourceUrl,
	})) as Extract<InteractiveBeat, { mechanic: "source-duel" }>["sourceCards"];
}

function projectVisual(
	id: string,
	visual: HistoricalVisual,
): PublicMediaRecord {
	return {
		id,
		alt: visual.alt,
		caption: visual.caption,
		credit: visual.credit,
		license: visual.license,
		licenseRationale: visual.licenseRationale,
		sourceUrl: visual.sourceUrl,
		originalUrl: visual.originalUrl,
		derivative: visual.derivative,
		focalPoint: visual.focalPoint,
		renditions: [
			{
				path: visual.src,
				format: "webp",
				width: visual.width,
				height: visual.height,
				sha256: visual.sha256,
			},
		],
	};
}

function validateCatalogIdentity(events: Event[]): void {
	const slugs = new Set<string>();
	for (const event of events) {
		if (slugs.has(event.slug))
			throw new Error(`Duplicate event slug: ${event.slug}`);
		slugs.add(event.slug);
		validateEventBounds(event);
	}
}

function validateEventBounds(event: Event): void {
	assertMaximum(event.title, RELEASE_LIMITS.titleCharacters, "title");
	assertMaximum(event.summary, RELEASE_LIMITS.summaryCharacters, "summary");
	assertMaximum(event.body, RELEASE_LIMITS.bodyCharacters, "body");
	if (!isSupportedEditorMarkdown(event.body)) {
		throw new Error(`Event ${event.slug} body contains unsupported Markdown`);
	}
	assertArray(event.topics, RELEASE_LIMITS.topics, "topics");
	assertArray(event.profiles, RELEASE_LIMITS.profiles, "profiles");
	assertArray(event.sources, RELEASE_LIMITS.sources, "sources");
	if (new Set(event.topics).size !== event.topics.length) {
		throw new Error(`Event ${event.slug} has duplicate topics`);
	}
	if (new Set(event.profiles).size !== event.profiles.length) {
		throw new Error(`Event ${event.slug} has duplicate profiles`);
	}
	const sourceUrls = new Set<string>();
	for (const source of event.sources) {
		assertMaximum(
			source.title,
			RELEASE_LIMITS.sourceTitleCharacters,
			"source title",
		);
		assertMaximum(
			source.publisher,
			RELEASE_LIMITS.sourcePublisherCharacters,
			"source publisher",
		);
		assertMaximum(source.url, RELEASE_LIMITS.sourceUrlCharacters, "source URL");
		if (sourceUrls.has(source.url)) {
			throw new Error(`Event ${event.slug} has duplicate source URLs`);
		}
		sourceUrls.add(source.url);
	}
	for (const [topic, label] of Object.entries(event.topicLabels ?? {})) {
		if (!event.topics.includes(topic)) {
			throw new Error(`Event ${event.slug} has unrelated topic label ${topic}`);
		}
		assertMaximum(label, RELEASE_LIMITS.topicLabelCharacters, "topic label");
	}
}

function collectStrictTopicLabels(events: Event[]): Record<string, string> {
	const labels = new Map<string, string>();
	const topics = new Set<string>();
	for (const event of events) {
		for (const topic of event.topics) {
			topics.add(topic);
			const label = event.topicLabels?.[topic];
			if (!label) continue;
			const existing = labels.get(topic);
			if (existing && existing !== label) {
				throw new Error(
					`Conflicting topic label for ${topic}: ${existing} / ${label}`,
				);
			}
			labels.set(topic, label);
		}
	}
	return Object.fromEntries(
		[...topics]
			.sort(compareAscii)
			.map((topic) => [topic, labels.get(topic) ?? formatEventTag(topic)]),
	);
}

function sortRecord(value: Record<string, string>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(value).sort(([left], [right]) => compareAscii(left, right)),
	);
}

function canonicalizeJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalizeJson);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(
		Object.entries(value)
			.filter(([, child]) => child !== undefined)
			.sort(([left], [right]) => compareAscii(left, right))
			.map(([key, child]) => [key, canonicalizeJson(child)]),
	);
}

function encodeJson(
	value: unknown,
	maximumBytes: number,
	artifactPath: string,
) {
	const bytes = encoder.encode(`${JSON.stringify(canonicalizeJson(value))}\n`);
	if (bytes.byteLength > maximumBytes) {
		throw new Error(
			`Artifact ${artifactPath} exceeds ${maximumBytes} bytes (${bytes.byteLength})`,
		);
	}
	return bytes;
}

function artifactRole(artifactPath: string): ArtifactRole {
	if (artifactPath.includes("/events/")) return "event";
	if (artifactPath.endsWith("/facets.json")) return "facets";
	if (artifactPath.endsWith("/media.json")) return "media";
	if (artifactPath.endsWith("/search.json")) return "search";
	throw new Error(`Unknown release artifact role: ${artifactPath}`);
}

function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function assertImmutableRevision(value: string, label: string): void {
	if (!immutableRevisionPattern.test(value)) {
		throw new Error(
			`${label} revision must be a 40-character lowercase hexadecimal SHA`,
		);
	}
}

function assertMaximum(value: string, maximum: number, field: string): void {
	if (value.length > maximum) {
		throw new Error(`${field} exceeds ${maximum} characters`);
	}
}

function assertArray(
	value: readonly unknown[],
	maximum: number,
	field: string,
): void {
	if (value.length > maximum) {
		throw new Error(`${field} exceeds ${maximum} items`);
	}
}

async function assertSeparateTrees(
	eventsDirectory: string,
	outputDirectory: string,
): Promise<void> {
	const [events, output] = await Promise.all([
		resolvePotentialRealPath(eventsDirectory),
		resolvePotentialRealPath(outputDirectory),
	]);
	if (
		events === output ||
		isInside(events, output) ||
		isInside(output, events)
	) {
		throw new Error("Release output must be separate from canonical content");
	}
}

async function resolvePotentialRealPath(target: string): Promise<string> {
	let current = path.resolve(target);
	const missingSegments: string[] = [];
	while (true) {
		try {
			return path.join(await realpath(current), ...missingSegments);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			const parent = path.dirname(current);
			if (parent === current) throw error;
			missingSegments.unshift(path.basename(current));
			current = parent;
		}
	}
}

function isInside(parent: string, candidate: string): boolean {
	const relative = path.relative(parent, candidate);
	return (
		Boolean(relative) &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative)
	);
}

async function mapBounded<Value>(
	values: Value[],
	concurrency: number,
	operation: (value: Value, index: number) => Promise<void>,
): Promise<void> {
	let nextIndex = 0;
	async function worker() {
		while (nextIndex < values.length) {
			const index = nextIndex;
			nextIndex += 1;
			await operation(values[index], index);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, values.length) }, () =>
			worker(),
		),
	);
}

function compareAscii(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}
