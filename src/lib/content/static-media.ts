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
import { historicalVisuals } from "./event-media";
import { historicalVisualSourcePaths } from "./static-media-sources";

const maximumWebPBytes = 2 * 1024 ** 2;
const maximumDimension = 2_400;
const maximumPixels = 6_000_000;
const metadataChunks = new Set(["EXIF", "ICCP", "XMP "]);

export type StaticMediaRecord = {
	path: string;
	width: number;
	height: number;
	bytes: number;
	sha256: string;
};

export async function stageStaticMedia({
	sourceRoot,
	publicRoot,
	generatedRoot,
	removePath = rm,
}: {
	sourceRoot: string;
	publicRoot: string;
	generatedRoot: string;
	removePath?: typeof rm;
}): Promise<{
	fileCount: number;
	totalBytes: number;
	media: Record<string, StaticMediaRecord>;
}> {
	const sourceRootDirectory = await requireRealDirectory(
		sourceRoot,
		"Media source root",
	);
	const sourceDirectory = await requireRealDirectory(
		path.join(sourceRootDirectory, "media", "sources"),
		"Media source directory",
	);
	const publicRootDirectory = await ensureRealDirectory(
		publicRoot,
		"Public media root",
	);
	const publicMediaDirectory = await ensureRealDirectory(
		path.join(publicRootDirectory, "media"),
		"Public media directory",
	);
	const generatedRootDirectory = await ensureRealDirectory(
		generatedRoot,
		"Generated media directory",
	);
	const prepared = new Map<
		string,
		{ bytes: Buffer; record: StaticMediaRecord }
	>();
	const media: Record<string, StaticMediaRecord> = {};
	for (const [id, visual] of Object.entries(historicalVisuals).sort(
		([left], [right]) => compareAscii(left, right),
	)) {
		const sourcePath = path.resolve(
			sourceRootDirectory,
			historicalVisualSourcePaths[
				id as keyof typeof historicalVisualSourcePaths
			],
		);
		const resolvedSourcePath = await realpath(sourcePath);
		if (!isInside(sourceDirectory, resolvedSourcePath)) {
			throw new Error(`Media source escapes trusted directory: ${id}`);
		}
		const metadata = await lstat(sourcePath);
		if (metadata.isSymbolicLink() || !metadata.isFile()) {
			throw new Error(`Media source must be a real file: ${id}`);
		}
		if (metadata.size > maximumWebPBytes) {
			throw new Error(`Media source exceeds ${maximumWebPBytes} bytes: ${id}`);
		}
		const bytes = await readFile(resolvedSourcePath);
		const dimensions = inspectSanitizedWebP(bytes);
		const sha256 = hashBytes(bytes);
		const expectedPath = `/media/assets/${sha256}.webp`;
		if (
			sha256 !== visual.sha256 ||
			visual.src !== expectedPath ||
			dimensions.width !== visual.width ||
			dimensions.height !== visual.height
		) {
			throw new Error(`Media metadata does not match source bytes: ${id}`);
		}
		const record = {
			path: expectedPath,
			width: dimensions.width,
			height: dimensions.height,
			bytes: bytes.byteLength,
			sha256,
		};
		media[id] = record;
		prepared.set(sha256, { bytes, record });
	}

	const assetsDirectory = path.join(publicMediaDirectory, "assets");
	for (const { bytes, record } of prepared.values()) {
		const existingPath = path.join(publicRootDirectory, record.path.slice(1));
		try {
			const existing = await readFile(existingPath);
			if (!existing.equals(bytes)) {
				throw new Error(
					`Existing immutable media asset differs: ${record.sha256}`,
				);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}

	const stagedDirectory = path.join(
		publicMediaDirectory,
		`.assets-${randomUUID()}`,
	);
	const backupDirectory = path.join(
		generatedRootDirectory,
		`.media-assets-backup-${randomUUID()}`,
	);
	let backedUp = false;
	let activated = false;
	try {
		await mkdir(stagedDirectory, { recursive: true });
		for (const [sha256, { bytes }] of [...prepared].sort(([left], [right]) =>
			compareAscii(left, right),
		)) {
			await writeFile(path.join(stagedDirectory, `${sha256}.webp`), bytes, {
				flag: "wx",
			});
		}
		await requireRealDirectory(publicRootDirectory, "Public media root");
		await requireRealDirectory(publicMediaDirectory, "Public media directory");
		await requireOptionalRealDirectory(
			assetsDirectory,
			"Public media assets directory",
		);
		try {
			await rename(assetsDirectory, backupDirectory);
			backedUp = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
		await rename(stagedDirectory, assetsDirectory);
		activated = true;
		await requireRealDirectory(
			generatedRootDirectory,
			"Generated media directory",
		);
		const pointerPath = path.join(generatedRootDirectory, "media-assets.json");
		const temporaryPointer = `${pointerPath}.${randomUUID()}`;
		await writeFile(
			temporaryPointer,
			`${JSON.stringify(
				{
					schemaVersion: 1,
					fileCount: prepared.size,
					totalBytes: [...prepared.values()].reduce(
						(total, value) => total + value.bytes.byteLength,
						0,
					),
					media,
				},
				null,
				2,
			)}\n`,
			{ flag: "wx" },
		);
		await rename(temporaryPointer, pointerPath);
		if (backedUp) {
			await removePath(backupDirectory, { recursive: true, force: true }).catch(
				() => {
					console.warn(
						JSON.stringify({ event: "media-backup-cleanup-failed" }),
					);
				},
			);
		}
	} catch (error) {
		if (activated) {
			await removePath(assetsDirectory, { recursive: true, force: true });
			if (backedUp) await rename(backupDirectory, assetsDirectory);
		}
		throw error;
	} finally {
		await removePath(stagedDirectory, { recursive: true, force: true });
		if (!activated && backedUp) {
			await rename(backupDirectory, assetsDirectory).catch(() => undefined);
		}
	}
	return {
		fileCount: prepared.size,
		totalBytes: [...prepared.values()].reduce(
			(total, value) => total + value.bytes.byteLength,
			0,
		),
		media,
	};
}

export function inspectSanitizedWebP(bytes: Uint8Array): {
	width: number;
	height: number;
} {
	const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (
		buffer.byteLength < 30 ||
		buffer.toString("ascii", 0, 4) !== "RIFF" ||
		buffer.toString("ascii", 8, 12) !== "WEBP" ||
		buffer.readUInt32LE(4) !== buffer.byteLength - 8
	) {
		throw new Error("Media source is not a bounded RIFF WebP");
	}
	let offset = 12;
	let dimensions: { width: number; height: number } | null = null;
	while (offset < buffer.byteLength) {
		if (offset + 8 > buffer.byteLength) {
			throw new Error("WebP chunk header is truncated");
		}
		const type = buffer.toString("ascii", offset, offset + 4);
		const size = buffer.readUInt32LE(offset + 4);
		const dataOffset = offset + 8;
		const paddedSize = size + (size % 2);
		if (dataOffset + paddedSize > buffer.byteLength) {
			throw new Error("WebP chunk exceeds file bounds");
		}
		if (metadataChunks.has(type)) {
			throw new Error(`WebP contains forbidden metadata chunk ${type.trim()}`);
		}
		if (type === "VP8 ") {
			if (dimensions) throw new Error("WebP contains multiple image chunks");
			const frameTag =
				(buffer[dataOffset] ?? 0) |
				((buffer[dataOffset + 1] ?? 0) << 8) |
				((buffer[dataOffset + 2] ?? 0) << 16);
			const firstPartitionBytes = frameTag >>> 5;
			if (
				size < 10 ||
				(frameTag & 1) !== 0 ||
				(frameTag & 0x10) === 0 ||
				firstPartitionBytes < 1 ||
				firstPartitionBytes > size - 10 ||
				buffer[dataOffset + 3] !== 0x9d ||
				buffer[dataOffset + 4] !== 0x01 ||
				buffer[dataOffset + 5] !== 0x2a
			) {
				throw new Error("WebP VP8 keyframe header or partition is invalid");
			}
			dimensions = {
				width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
				height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
			};
		} else {
			throw new Error(`Unsupported WebP chunk ${type.trim()}`);
		}
		offset = dataOffset + paddedSize;
	}
	if (!dimensions) throw new Error("WebP contains no image frame");
	if (
		dimensions.width < 1 ||
		dimensions.height < 1 ||
		dimensions.width > maximumDimension ||
		dimensions.height > maximumDimension ||
		dimensions.width * dimensions.height > maximumPixels
	) {
		throw new Error("WebP dimensions exceed media bounds");
	}
	return dimensions;
}

function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function compareAscii(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
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

function isInside(parent: string, candidate: string): boolean {
	const relative = path.relative(parent, candidate);
	return (
		Boolean(relative) &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative)
	);
}
