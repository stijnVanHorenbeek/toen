import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	selectPublicReleaseFiles,
	writeReleaseArtifacts,
} from "../src/lib/content/release-artifacts";

const execute = promisify(execFile);
const immutableRevisionPattern = /^[0-9a-f]{40}$/;

type RunGit = (arguments_: string[], cwd: string) => Promise<string>;
type GitCheckout = { sha: string; topLevel: string };
type ContentSnapshot = {
	eventsDirectory: string;
	cleanup: () => Promise<void>;
};
type SnapshotContent = (
	contentCheckout: GitCheckout,
) => Promise<ContentSnapshot>;

async function defaultRunGit(
	arguments_: string[],
	cwd: string,
): Promise<string> {
	const { stdout } = await execute("git", arguments_, {
		cwd,
		maxBuffer: 16 * 1024 ** 2,
	});
	return stdout;
}

async function defaultSnapshotContent(
	contentCheckout: GitCheckout,
): Promise<ContentSnapshot> {
	const temporaryRoot = await mkdtemp(
		path.join(tmpdir(), "toen-content-snapshot-"),
	);
	const archivePath = path.join(temporaryRoot, "content.tar");
	const snapshotRoot = path.join(temporaryRoot, "snapshot");
	try {
		await mkdir(snapshotRoot);
		await execute(
			"git",
			[
				"archive",
				"--format=tar",
				`--output=${archivePath}`,
				contentCheckout.sha,
				"content/events",
			],
			{ cwd: contentCheckout.topLevel },
		);
		await execute("tar", ["-xf", archivePath, "-C", snapshotRoot]);
		const eventsDirectory = path.join(snapshotRoot, "content", "events");
		const eventsMetadata = await lstat(eventsDirectory);
		if (eventsMetadata.isSymbolicLink() || !eventsMetadata.isDirectory()) {
			throw new Error("Content snapshot event root must be a real directory");
		}
		const [resolvedSnapshot, resolvedEvents] = await Promise.all([
			realpath(snapshotRoot),
			realpath(eventsDirectory),
		]);
		if (!isInside(resolvedSnapshot, resolvedEvents)) {
			throw new Error("Content snapshot event root escapes snapshot");
		}
	} catch (error) {
		await rm(temporaryRoot, { recursive: true, force: true });
		throw error;
	}
	return {
		eventsDirectory: path.join(snapshotRoot, "content", "events"),
		cleanup: () => rm(temporaryRoot, { recursive: true, force: true }),
	};
}

export async function generateReleaseArtifacts({
	appRoot = process.cwd(),
	contentRoot = path.resolve(
		appRoot,
		process.env.TOEN_CONTENT_DIR ?? "../toen-content",
	),
	outputDirectory = path.join(appRoot, ".generated", "release"),
	expectedAppSha,
	expectedContentSha,
	runGit = defaultRunGit,
	snapshotContent = defaultSnapshotContent,
}: {
	appRoot?: string;
	contentRoot?: string;
	outputDirectory?: string;
	expectedAppSha?: string;
	expectedContentSha?: string;
	runGit?: RunGit;
	snapshotContent?: SnapshotContent;
} = {}) {
	const [appCheckout, contentCheckout] = await Promise.all([
		resolveCleanGitCheckout(appRoot, "Application", runGit),
		resolveCleanGitCheckout(contentRoot, "Content", runGit),
	]);
	await assertDistinctGitCheckouts(appCheckout, contentCheckout);
	await assertReleaseOutput(appCheckout, contentCheckout, outputDirectory);
	if (expectedAppSha !== undefined && expectedAppSha !== appCheckout.sha) {
		throw new Error(
			`Application revision mismatch: expected ${expectedAppSha}`,
		);
	}
	if (
		expectedContentSha !== undefined &&
		expectedContentSha !== contentCheckout.sha
	) {
		throw new Error(
			`Content revision mismatch: expected ${expectedContentSha}`,
		);
	}
	const snapshot = await snapshotContent(contentCheckout);
	try {
		const release = await writeReleaseArtifacts({
			eventsDirectory: snapshot.eventsDirectory,
			outputDirectory,
			appSha: appCheckout.sha,
			contentSha: contentCheckout.sha,
		});
		return {
			...release,
			appSha: appCheckout.sha,
			contentSha: contentCheckout.sha,
			outputDirectory,
			publicFileCount: selectPublicReleaseFiles(release).size,
		};
	} finally {
		await snapshot.cleanup();
	}
}

export async function resolveCleanGitCheckout(
	root: string,
	label: "Application" | "Content",
	runGit: RunGit = defaultRunGit,
): Promise<GitCheckout> {
	const [revisionOutput, statusOutput, topLevelOutput] = await Promise.all([
		runGit(["rev-parse", "HEAD"], root),
		runGit(["status", "--porcelain", "--untracked-files=all"], root),
		runGit(["rev-parse", "--show-toplevel"], root),
	]);
	const revision = revisionOutput.trim();
	if (!immutableRevisionPattern.test(revision)) {
		throw new Error(
			`${label} revision must be a 40-character lowercase hexadecimal SHA`,
		);
	}
	if (statusOutput.trim()) {
		throw new Error(
			`Dirty ${label.toLowerCase()} checkout cannot produce a release`,
		);
	}
	const topLevel = topLevelOutput.trim();
	if (!path.isAbsolute(topLevel)) {
		throw new Error(`${label} Git top-level must be an absolute path`);
	}
	return { sha: revision, topLevel };
}

async function assertDistinctGitCheckouts(
	appCheckout: GitCheckout,
	contentCheckout: GitCheckout,
): Promise<void> {
	const [appTopLevel, contentTopLevel] = await Promise.all([
		realpath(appCheckout.topLevel),
		realpath(contentCheckout.topLevel),
	]);
	if (
		appTopLevel === contentTopLevel ||
		isInside(appTopLevel, contentTopLevel) ||
		isInside(contentTopLevel, appTopLevel)
	) {
		throw new Error("Application and content must use distinct Git checkouts");
	}
}

async function assertReleaseOutput(
	appCheckout: GitCheckout,
	contentCheckout: GitCheckout,
	outputDirectory: string,
): Promise<void> {
	const [appTopLevel, contentTopLevel, output] = await Promise.all([
		realpath(appCheckout.topLevel),
		realpath(contentCheckout.topLevel),
		resolvePotentialRealPath(outputDirectory),
	]);
	const generatedRoot = path.join(appTopLevel, ".generated");
	if (
		(output !== generatedRoot && !isInside(generatedRoot, output)) ||
		output === contentTopLevel ||
		isInside(contentTopLevel, output)
	) {
		throw new Error("Release output must stay inside application .generated");
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

function parseArguments(arguments_: string[]) {
	const options: {
		contentRoot?: string;
		outputDirectory?: string;
		expectedAppSha?: string;
		expectedContentSha?: string;
	} = {};
	for (const argument of arguments_) {
		const [name, value] = argument.split("=", 2);
		if (!value) throw new Error(`Invalid release argument: ${argument}`);
		switch (name) {
			case "--content-dir":
				options.contentRoot = path.resolve(value);
				break;
			case "--output-dir":
				options.outputDirectory = path.resolve(value);
				break;
			case "--app-sha":
				options.expectedAppSha = value;
				break;
			case "--content-sha":
				options.expectedContentSha = value;
				break;
			default:
				throw new Error(`Unknown release argument: ${name}`);
		}
	}
	return options;
}

async function main() {
	const result = await generateReleaseArtifacts(
		parseArguments(process.argv.slice(2)),
	);
	console.log(
		JSON.stringify({
			event: "release-artifacts-generated",
			releaseId: result.releaseId,
			appSha: result.appSha,
			contentSha: result.contentSha,
			outputDirectory: result.outputDirectory,
			buildFileCount: result.files.size,
			publicFileCount: result.publicFileCount,
		}),
	);
}

if (
	process.argv[1] &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
	void main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
