import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type BrowserAssetPointer = {
	eventSearchWorkerUrl: string;
	eventSearchWorkerSha256: string;
	eventSearchWorkerBytes: number;
};

export async function readBrowserAssetPointer(
	appRoot = process.cwd(),
): Promise<BrowserAssetPointer> {
	const value = JSON.parse(
		await readFile(
			path.join(appRoot, ".generated", "browser-assets.json"),
			"utf8",
		),
	) as Record<string, unknown>;
	if (value.schemaVersion !== 1) {
		throw new Error("Unsupported browser asset pointer schema");
	}
	if (
		typeof value.eventSearchWorkerUrl !== "string" ||
		!/^\/workers\/event-search-[0-9a-f]{20}\.js$/.test(
			value.eventSearchWorkerUrl,
		) ||
		typeof value.eventSearchWorkerSha256 !== "string" ||
		!/^[0-9a-f]{64}$/.test(value.eventSearchWorkerSha256) ||
		typeof value.eventSearchWorkerBytes !== "number" ||
		!Number.isSafeInteger(value.eventSearchWorkerBytes) ||
		value.eventSearchWorkerBytes < 1 ||
		value.eventSearchWorkerBytes > 128 * 1024
	) {
		throw new Error("Browser asset pointer is invalid");
	}
	const worker = await readFile(
		path.join(appRoot, "public", value.eventSearchWorkerUrl.slice(1)),
	);
	if (
		!value.eventSearchWorkerUrl.includes(
			value.eventSearchWorkerSha256.slice(0, 20),
		) ||
		worker.byteLength !== value.eventSearchWorkerBytes ||
		createHash("sha256").update(worker).digest("hex") !==
			value.eventSearchWorkerSha256
	) {
		throw new Error("Browser Worker does not match checksum pointer");
	}
	return {
		eventSearchWorkerUrl: value.eventSearchWorkerUrl,
		eventSearchWorkerSha256: value.eventSearchWorkerSha256,
		eventSearchWorkerBytes: value.eventSearchWorkerBytes,
	};
}
