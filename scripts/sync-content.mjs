import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const immutableRevisionPattern = /^[0-9a-f]{40}$/;
const mainReference = "refs/heads/main";
const defaultRepository =
	"https://github.com/stijnVanHorenbeek/toen-content.git";

async function defaultRunGit(args, options = {}) {
	const { stdout } = await execute("git", args, options);
	return stdout;
}

async function run(command, args, options = {}) {
	await execute(command, args, { ...options, stdio: "inherit" });
}

export function parseRemoteRevision(output) {
	const matches = output
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => line.trim().split(/\s+/))
		.filter(([, reference]) => reference === mainReference);
	if (
		matches.length !== 1 ||
		!immutableRevisionPattern.test(matches[0]?.[0] ?? "")
	) {
		throw new Error(
			`Could not resolve one immutable ${mainReference} revision`,
		);
	}
	return matches[0][0];
}

export async function resolveApplicationRevision({
	appRoot,
	environmentRevision,
	runGit = defaultRunGit,
}) {
	const supplied = environmentRevision?.trim();
	if (supplied && immutableRevisionPattern.test(supplied)) return supplied;

	const revision = (
		await runGit(["rev-parse", "HEAD"], { cwd: appRoot })
	).trim();
	if (!immutableRevisionPattern.test(revision)) {
		throw new Error("Application revision must be a 40-character Git SHA");
	}
	return revision;
}

export async function resolveContentRevision({
	repository,
	override,
	runGit = defaultRunGit,
}) {
	if (override !== undefined) {
		if (!immutableRevisionPattern.test(override)) {
			throw new Error(
				"TOEN_CONTENT_SHA must be a valid 40-character lowercase hexadecimal SHA",
			);
		}
		return override;
	}

	const output = await runGit(["ls-remote", repository, mainReference]);
	return parseRemoteRevision(output);
}

export async function verifyContentCheckout(checkoutDirectory) {
	await run("pnpm", ["install", "--frozen-lockfile"], {
		cwd: checkoutDirectory,
	});
	await run("pnpm", ["verify"], { cwd: checkoutDirectory });
}

export async function verifyLocalContentDirectory(checkoutDirectory) {
	await run("pnpm", ["verify"], { cwd: checkoutDirectory });
}

export async function publishContentRevision(
	sourceEvents,
	targetContent,
	revision,
	dirty = false,
) {
	const parent = path.dirname(targetContent);
	const staged = path.join(parent, `.content-${crypto.randomUUID()}`);
	const backup = path.join(parent, `.content-backup-${crypto.randomUUID()}`);
	await mkdir(parent, { recursive: true });

	let backedUp = false;
	try {
		await mkdir(staged);
		await cp(sourceEvents, path.join(staged, "events"), { recursive: true });
		const revisionMetadata = dirty
			? { sha: revision, dirty: true }
			: { sha: revision };
		await writeFile(
			path.join(staged, "revision.json"),
			`${JSON.stringify(revisionMetadata, null, "\t")}\n`,
		);

		try {
			await rename(targetContent, backup);
			backedUp = true;
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}

		try {
			await rename(staged, targetContent);
		} catch (error) {
			if (backedUp) {
				await rename(backup, targetContent);
				backedUp = false;
			}
			throw error;
		}

		if (backedUp) {
			await rm(backup, { recursive: true, force: true }).catch(() => {
				console.warn(
					JSON.stringify({ event: "content-backup-cleanup-failed" }),
				);
			});
		}
	} finally {
		await rm(staged, { recursive: true, force: true });
	}
}

export async function synchronizeContent({
	repository = defaultRepository,
	appRoot = process.cwd(),
	appRevision = /** @type {string | null} */ (null),
	override = /** @type {string | undefined} */ (undefined),
	localDirectory = /** @type {string | undefined} */ (undefined),
	runGit = defaultRunGit,
	verifyCheckout = verifyContentCheckout,
	verifyLocalDirectory = verifyLocalContentDirectory,
	projectRelease = /** @type {null | ((input: { appRoot: string, appRevision: string | null, checkoutDirectory: string, contentRevision: string }) => Promise<void>)} */ (
		null
	),
}) {
	const configuredLocalDirectory = localDirectory?.trim();
	if (configuredLocalDirectory) {
		if (override !== undefined) {
			throw new Error(
				"TOEN_CONTENT_DIR and TOEN_CONTENT_SHA cannot be used together",
			);
		}
		const checkoutDirectory = path.resolve(appRoot, configuredLocalDirectory);
		const revision = (
			await runGit(["rev-parse", "HEAD"], { cwd: checkoutDirectory })
		).trim();
		if (!immutableRevisionPattern.test(revision)) {
			throw new Error("Local content revision must be a 40-character Git SHA");
		}
		const dirty = Boolean(
			(
				await runGit(["status", "--porcelain"], {
					cwd: checkoutDirectory,
				})
			).trim(),
		);

		await verifyLocalDirectory(checkoutDirectory);
		await publishContentRevision(
			path.join(checkoutDirectory, "content/events"),
			path.join(appRoot, "content"),
			revision,
			dirty,
		);
		await projectRelease?.({
			appRoot,
			appRevision,
			checkoutDirectory,
			contentRevision: revision,
		});
		console.log(
			JSON.stringify({
				event: "content-synchronized",
				appSha: appRevision,
				contentSha: revision,
				contentDirty: dirty,
				contentSource: "local",
			}),
		);
		return revision;
	}

	const revision = await resolveContentRevision({
		repository,
		override,
		runGit,
	});
	const temporaryDirectory = await mkdtemp(
		path.join(tmpdir(), "toen-content-"),
	);
	const checkoutDirectory = path.join(temporaryDirectory, "checkout");

	try {
		await mkdir(checkoutDirectory);
		await runGit(["init"], { cwd: checkoutDirectory });
		await runGit(["remote", "add", "origin", repository], {
			cwd: checkoutDirectory,
		});
		await runGit(["fetch", "--depth=1", "origin", revision], {
			cwd: checkoutDirectory,
		});
		await runGit(["checkout", "--detach", "FETCH_HEAD"], {
			cwd: checkoutDirectory,
		});
		await verifyCheckout(checkoutDirectory);

		await publishContentRevision(
			path.join(checkoutDirectory, "content/events"),
			path.join(appRoot, "content"),
			revision,
		);
		await projectRelease?.({
			appRoot,
			appRevision,
			checkoutDirectory,
			contentRevision: revision,
		});
	} finally {
		await rm(temporaryDirectory, { recursive: true, force: true });
	}

	console.log(
		JSON.stringify({
			event: "content-synchronized",
			appSha: appRevision,
			contentSha: revision,
		}),
	);
	return revision;
}

if (
	process.argv[1] &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
	const appRoot = process.cwd();
	const appRevision = await resolveApplicationRevision({
		appRoot,
		environmentRevision: process.env.WORKERS_CI_COMMIT_SHA,
	});
	const shouldProjectRelease = process.env.TOEN_PROJECT_RELEASE === "1";
	await synchronizeContent({
		appRoot,
		appRevision,
		override: process.env.TOEN_CONTENT_SHA,
		localDirectory: process.env.TOEN_CONTENT_DIR,
		projectRelease: shouldProjectRelease
			? async ({ checkoutDirectory, contentRevision }) => {
					await run(
						"pnpm",
						[
							"content:project",
							`--content-dir=${checkoutDirectory}`,
							`--app-sha=${appRevision}`,
							`--content-sha=${contentRevision}`,
						],
						{ cwd: appRoot },
					);
				}
			: null,
	});
	if (shouldProjectRelease) {
		await run("pnpm", ["content:stage"], { cwd: appRoot });
	}
}
