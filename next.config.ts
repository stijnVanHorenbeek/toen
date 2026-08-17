import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { verifyStaticMediaBuild } from "./src/lib/content/static-media-build";

const generatedDirectory = path.join(process.cwd(), ".generated");
const discovery = readGeneratedJson("discovery.json");
const browserAssets = readGeneratedJson("browser-assets.json");
const mediaAssets = readGeneratedJson("media-assets.json");
const releaseId = requireMatch(
	discovery.releaseId,
	/^[0-9a-f]{64}$/,
	"discovery release ID",
);
const searchIndexUrl = requireMatch(
	discovery.searchIndexUrl,
	new RegExp(`^/releases/${releaseId}/search\\.json$`),
	"discovery search URL",
);
const eventSearchWorkerUrl = requireMatch(
	browserAssets.eventSearchWorkerUrl,
	/^\/workers\/event-search-[0-9a-f]{20}\.js$/,
	"event search Worker URL",
);
const eventSearchWorkerSha256 = requireMatch(
	browserAssets.eventSearchWorkerSha256,
	/^[0-9a-f]{64}$/,
	"event search Worker SHA-256",
);
const eventSearchWorkerBytes = requireInteger(
	browserAssets.eventSearchWorkerBytes,
	"event search Worker byte length",
	128 * 1024,
);
const eventSearchWorker = readFileSync(
	path.join(process.cwd(), "public", eventSearchWorkerUrl.slice(1)),
);
if (
	eventSearchWorker.byteLength !== eventSearchWorkerBytes ||
	createHash("sha256").update(eventSearchWorker).digest("hex") !==
		eventSearchWorkerSha256 ||
	!eventSearchWorkerUrl.includes(eventSearchWorkerSha256.slice(0, 20))
) {
	throw new Error("Event search Worker does not match generated pointer");
}
verifyStaticMediaBuild(mediaAssets);
if (
	discovery.development === true &&
	process.env.NODE_ENV === "production" &&
	process.env.TOEN_ALLOW_DEVELOPMENT_SEARCH !== "1"
) {
	throw new Error("Development search artifact cannot enter production build");
}

const nextConfig: NextConfig = {
	output: "standalone",
	env: {
		TOEN_DISCOVERY_RELEASE_ID: releaseId,
		TOEN_SEARCH_INDEX_URL: searchIndexUrl,
		TOEN_EVENT_SEARCH_WORKER_URL: eventSearchWorkerUrl,
	},
};

export default nextConfig;

function readGeneratedJson(filename: string): Record<string, unknown> {
	try {
		const value = JSON.parse(
			readFileSync(path.join(generatedDirectory, filename), "utf8"),
		) as unknown;
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error(`${filename} must contain an object`);
		}
		return value as Record<string, unknown>;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Missing ${filename}. Generate release and browser assets before Next.js.`,
			);
		}
		throw error;
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

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
