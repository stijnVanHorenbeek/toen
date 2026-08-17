import { createHash, randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";

const releaseIdPattern = /^[0-9a-f]{64}$/;
const checksumPattern = /^[0-9a-f]{64}$/;
const maximumPointerBytes = 4 * 1024;
const maximumManifestBytes = 2 * 1024 ** 2;

export async function stagePublicRelease({
	releaseDirectory,
	publicDirectory,
	generatedDirectory,
	removePath = rm,
}: {
	releaseDirectory: string;
	publicDirectory: string;
	generatedDirectory: string;
	removePath?: typeof rm;
}): Promise<{ releaseId: string; fileCount: number }> {
	const releaseRoot = await requireRealDirectory(
		releaseDirectory,
		"Release source directory",
	);
	const publicRoot = await ensureRealDirectory(
		publicDirectory,
		"Public release directory",
	);
	const generatedRoot = await ensureRealDirectory(
		generatedDirectory,
		"Generated release directory",
	);
	const pointerBytes = await readBounded(
		path.join(releaseRoot, "release.json"),
		maximumPointerBytes,
	);
	const pointer = requireRecord(JSON.parse(pointerBytes.toString("utf8")));
	const releaseId = requireReleaseId(pointer.releaseId);
	const manifestPath = `releases/${releaseId}/manifest.json`;
	if (pointer.manifestPath !== manifestPath) {
		throw new Error("Release pointer manifest path does not match release ID");
	}
	const manifestBytes = await readBounded(
		path.join(releaseRoot, manifestPath),
		maximumManifestBytes,
	);
	if (
		typeof pointer.manifestSha256 !== "string" ||
		hashBytes(manifestBytes) !== pointer.manifestSha256
	) {
		throw new Error("Release manifest checksum does not match pointer");
	}
	const manifest = requireRecord(JSON.parse(manifestBytes.toString("utf8")));
	if (manifest.releaseId !== releaseId || !Array.isArray(manifest.artifacts)) {
		throw new Error("Release manifest identity is invalid");
	}
	const expected = new Map([
		[
			`releases/${releaseId}/search.json`,
			{ role: "search", maximumBytes: Math.floor(2.5 * 1024 ** 2) },
		],
		[
			`releases/${releaseId}/facets.json`,
			{ role: "facets", maximumBytes: 256 * 1024 },
		],
	]);
	const selected = manifest.artifacts.filter((value) => {
		const artifact = requireRecord(value);
		return artifact.delivery === "public";
	});
	if (selected.length !== expected.size) {
		throw new Error("Release manifest public artifact set is invalid");
	}

	const stagedRoot = path.join(publicRoot, `.releases-${randomUUID()}`);
	const activatedRoot = path.join(publicRoot, "releases");
	const backupRoot = path.join(
		generatedRoot,
		`.public-releases-backup-${randomUUID()}`,
	);
	let backedUp = false;
	let activated = false;
	try {
		for (const value of selected) {
			const artifact = requireRecord(value);
			if (typeof artifact.path !== "string") {
				throw new Error("Release artifact path is invalid");
			}
			const contract = expected.get(artifact.path);
			if (!contract || artifact.role !== contract.role) {
				throw new Error(
					"Release manifest attempted unexpected public artifact",
				);
			}
			if (
				typeof artifact.bytes !== "number" ||
				!Number.isSafeInteger(artifact.bytes) ||
				artifact.bytes < 0 ||
				artifact.bytes > contract.maximumBytes ||
				typeof artifact.sha256 !== "string" ||
				!checksumPattern.test(artifact.sha256)
			) {
				throw new Error(
					`Release artifact metadata is invalid: ${artifact.path}`,
				);
			}
			const bytes = await readBounded(
				path.join(releaseRoot, artifact.path),
				contract.maximumBytes,
			);
			if (
				bytes.byteLength !== artifact.bytes ||
				hashBytes(bytes) !== artifact.sha256
			) {
				throw new Error(`Release artifact checksum mismatch: ${artifact.path}`);
			}
			const destination = path.join(
				stagedRoot,
				path.relative(`releases`, artifact.path),
			);
			await mkdir(path.dirname(destination), { recursive: true });
			await writeFile(destination, bytes, { flag: "wx" });
			expected.delete(artifact.path);
		}
		if (expected.size !== 0) {
			throw new Error("Release manifest is missing public discovery artifacts");
		}
		await requireRealDirectory(publicRoot, "Public release directory");
		await requireOptionalRealDirectory(
			activatedRoot,
			"Active public releases directory",
		);
		try {
			await rename(activatedRoot, backupRoot);
			backedUp = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		await rename(stagedRoot, activatedRoot);
		activated = true;
		await requireRealDirectory(generatedRoot, "Generated release directory");
		const discovery = {
			schemaVersion: 1,
			releaseId,
			searchIndexUrl: `/releases/${releaseId}/search.json`,
			facetsUrl: `/releases/${releaseId}/facets.json`,
			development: false,
		};
		const temporaryPointer = path.join(
			generatedRoot,
			`.discovery-${randomUUID()}.json`,
		);
		await writeFile(
			temporaryPointer,
			`${JSON.stringify(discovery, null, 2)}\n`,
			{
				flag: "wx",
			},
		);
		await rename(temporaryPointer, path.join(generatedRoot, "discovery.json"));
		if (backedUp) {
			await removePath(backupRoot, { recursive: true, force: true }).catch(
				() => {
					console.warn(
						JSON.stringify({ event: "release-backup-cleanup-failed" }),
					);
				},
			);
		}
		return { releaseId, fileCount: selected.length };
	} catch (error) {
		if (activated) {
			await removePath(activatedRoot, { recursive: true, force: true });
			if (backedUp) await rename(backupRoot, activatedRoot);
		}
		throw error;
	} finally {
		await removePath(stagedRoot, { recursive: true, force: true });
		if (!activated && backedUp) {
			await rename(backupRoot, activatedRoot).catch(() => undefined);
		}
	}
}

async function readBounded(filePath: string, maximumBytes: number) {
	const metadata = await lstat(filePath);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Release artifact must be a real file: ${filePath}`);
	}
	const bytes = await readFile(filePath);
	if (bytes.byteLength > maximumBytes) {
		throw new Error(
			`Release artifact exceeds ${maximumBytes} bytes: ${filePath}`,
		);
	}
	return bytes;
}

async function requireRealDirectory(
	target: string,
	label: string,
): Promise<string> {
	const metadata = await lstat(target);
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error(`${label} must be a real directory`);
	}
	return realpath(target);
}

async function requireOptionalRealDirectory(
	target: string,
	label: string,
): Promise<void> {
	try {
		await requireRealDirectory(target, label);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
}

async function ensureRealDirectory(
	target: string,
	label: string,
): Promise<string> {
	try {
		return await requireRealDirectory(target, label);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const parent = await realpath(path.dirname(target));
	const created = path.join(parent, path.basename(target));
	await mkdir(created).catch((error) => {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
	});
	return requireRealDirectory(created, label);
}

function requireRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Release metadata must be an object");
	}
	return value as Record<string, unknown>;
}

function requireReleaseId(value: unknown): string {
	if (typeof value !== "string" || !releaseIdPattern.test(value)) {
		throw new Error("Release ID is invalid");
	}
	return value;
}

function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}
