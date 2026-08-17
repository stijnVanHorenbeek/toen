import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export function verifyStaticMediaBuild(
	value: Record<string, unknown>,
	appRoot = process.cwd(),
): void {
	if (
		value.schemaVersion !== 1 ||
		typeof value.fileCount !== "number" ||
		!Number.isSafeInteger(value.fileCount) ||
		value.fileCount < 0 ||
		value.fileCount > 5_000 ||
		typeof value.totalBytes !== "number" ||
		!Number.isSafeInteger(value.totalBytes) ||
		value.totalBytes < 0 ||
		!value.media ||
		typeof value.media !== "object" ||
		Array.isArray(value.media)
	) {
		throw new Error("Static media pointer is invalid");
	}
	const paths = new Set<string>();
	let totalBytes = 0;
	for (const [id, rawRecord] of Object.entries(
		value.media as Record<string, unknown>,
	)) {
		if (
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
			!rawRecord ||
			typeof rawRecord !== "object" ||
			Array.isArray(rawRecord)
		) {
			throw new Error("Static media record is invalid");
		}
		const record = rawRecord as Record<string, unknown>;
		const sha256 = requireMatch(
			record.sha256,
			/^[0-9a-f]{64}$/,
			`static media checksum for ${id}`,
		);
		const mediaPath = requireMatch(
			record.path,
			new RegExp(`^/media/assets/${sha256}\\.webp$`),
			`static media path for ${id}`,
		);
		const bytes = requireInteger(
			record.bytes,
			`static media byte length for ${id}`,
			2 * 1024 ** 2,
		);
		const asset = readFileSync(
			path.join(appRoot, "public", mediaPath.slice(1)),
		);
		if (
			asset.byteLength !== bytes ||
			createHash("sha256").update(asset).digest("hex") !== sha256
		) {
			throw new Error(`Static media asset does not match pointer: ${id}`);
		}
		if (!paths.has(mediaPath)) {
			paths.add(mediaPath);
			totalBytes += bytes;
		}
	}
	const mediaDirectory = path.join(appRoot, "public", "media", "assets");
	const directoryEntries = readdirSync(mediaDirectory, { withFileTypes: true });
	const expectedNames = new Set(
		[...paths].map((mediaPath) => path.basename(mediaPath)),
	);
	if (
		directoryEntries.some(
			(entry) => !entry.isFile() || !expectedNames.has(entry.name),
		) ||
		directoryEntries.length !== expectedNames.size ||
		paths.size !== value.fileCount ||
		totalBytes !== value.totalBytes
	) {
		throw new Error("Static media directory or totals do not match pointer");
	}
}

function requireInteger(
	value: unknown,
	label: string,
	maximum: number,
): number {
	if (
		typeof value !== "number" ||
		!Number.isSafeInteger(value) ||
		value < 1 ||
		value > maximum
	) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
}

function requireMatch(value: unknown, pattern: RegExp, label: string): string {
	if (typeof value !== "string" || !pattern.test(value)) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
}
