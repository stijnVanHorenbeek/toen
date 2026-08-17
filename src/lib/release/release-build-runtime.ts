import { createHash } from "node:crypto";
import { z } from "zod";
import {
	parseReleaseActivationLock,
	type ReleaseActivationLock,
	releaseActivationLockPath,
} from "./release-lock";
import {
	parseReleaseRequest,
	type ReleaseRequest,
	releaseRequestPath,
	releaseRequestSchema,
} from "./release-request";

const sha40 = z.string().regex(/^[0-9a-f]{40}$/);
const sha64 = z.string().regex(/^[0-9a-f]{64}$/);
const receiptCoreSchema = z.strictObject({
	kind: z.literal("toen-release-build"),
	schemaVersion: z.literal(1),
	request: releaseRequestSchema,
	releaseId: sha64,
	staticFileCount: z.number().int().positive().max(18_000),
	staticTreeSha256: sha64,
	adminWorkerSha256: sha64,
});
const receiptSchema = receiptCoreSchema.extend({ integritySha256: sha64 });

export type ReleaseBuildReceipt = z.infer<typeof receiptSchema>;

export async function resolveReleaseRequestForBuild({
	applicationSha,
	attempts = 30,
	buildUuid,
	contentBranch,
	contentRepository,
	delay = (milliseconds: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
	fetch = globalThis.fetch,
}: {
	applicationSha: string;
	attempts?: number;
	buildUuid: string;
	contentBranch: string;
	contentRepository: string;
	delay?: (milliseconds: number) => Promise<void>;
	fetch?: typeof globalThis.fetch;
}): Promise<ReleaseRequest> {
	sha40.parse(applicationSha);
	if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 60) {
		throw new Error("Release request attempts must be from 1 through 60");
	}
	validateContentLocation(contentRepository, contentBranch);
	const requestUrl = rawContentUrl(
		contentRepository,
		contentBranch,
		releaseRequestPath(buildUuid),
	);
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const response = await fetch(requestUrl, {
			headers: { Accept: "application/json" },
			cache: "no-store",
		});
		if (response.status === 404 && attempt < attempts) {
			await delay(2_000);
			continue;
		}
		if (!response.ok) {
			throw new Error(
				`Release request fetch failed with ${response.status} after ${attempt} attempt(s)`,
			);
		}
		const declaredLength = response.headers.get("Content-Length");
		if (declaredLength && Number(declaredLength) > 4_096) {
			throw new Error("Release request exceeds 4096 bytes");
		}
		const text = new TextDecoder("utf-8", { fatal: true }).decode(
			await readBoundedResponse(response, 4_096),
		);
		const request = parseReleaseRequest(text);
		if (request.buildUuid !== buildUuid) {
			throw new Error("Release request build UUID does not match build");
		}
		if (request.appSha !== applicationSha) {
			throw new Error("Release request application SHA does not match build");
		}
		return request;
	}
	throw new Error("Release request was not found");
}

async function readBoundedResponse(
	response: Response,
	maximumBytes: number,
): Promise<Uint8Array> {
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maximumBytes) {
			await reader.cancel();
			throw new Error("Release request exceeds 4096 bytes");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export async function resolveReleaseActivationLockForBuild({
	applicationSha,
	buildUuid,
	contentBranch,
	contentRepository,
	fetch = globalThis.fetch,
}: {
	applicationSha: string;
	buildUuid: string;
	contentBranch: string;
	contentRepository: string;
	fetch?: typeof globalThis.fetch;
}): Promise<Extract<ReleaseActivationLock, { state: "active" }>> {
	validateContentLocation(contentRepository, contentBranch);
	const response = await fetch(
		rawContentUrl(contentRepository, contentBranch, releaseActivationLockPath),
		{ headers: { Accept: "application/json" }, cache: "no-store" },
	);
	if (!response.ok) {
		throw new Error(
			`Release activation lock fetch failed with ${response.status}`,
		);
	}
	const lock = parseReleaseActivationLock(
		new TextDecoder("utf-8", { fatal: true }).decode(
			await readBoundedResponse(response, 4_096),
		),
	);
	if (
		lock.state !== "active" ||
		lock.buildUuid !== buildUuid ||
		lock.appSha !== applicationSha
	) {
		throw new Error("Release activation lock does not own current build");
	}
	return lock;
}

export function createReleaseBuildReceipt({
	adminWorkerSha256,
	releaseId,
	request,
	staticFileCount,
	staticTreeSha256,
}: {
	adminWorkerSha256: string;
	releaseId: string;
	request: ReleaseRequest;
	staticFileCount: number;
	staticTreeSha256: string;
}): ReleaseBuildReceipt {
	const core = receiptCoreSchema.parse({
		kind: "toen-release-build",
		schemaVersion: 1,
		request: parseReleaseRequest(JSON.stringify(request)),
		releaseId,
		staticFileCount,
		staticTreeSha256,
		adminWorkerSha256,
	});
	return { ...core, integritySha256: integrity(core) };
}

export function parseReleaseBuildReceipt(value: string): ReleaseBuildReceipt {
	const parsed = receiptSchema.parse(JSON.parse(value));
	const { integritySha256, ...core } = parsed;
	if (integrity(core) !== integritySha256) {
		throw new Error("Release build receipt integrity check failed");
	}
	return parsed;
}

function validateContentLocation(repository: string, branch: string) {
	if (!/^[^/]+\/[^/]+$/.test(repository)) {
		throw new Error("Content repository must be owner/repository");
	}
	if (!/^[A-Za-z0-9._-]+$/.test(branch)) {
		throw new Error("Content branch must be one safe path segment");
	}
}

function rawContentUrl(
	repositoryReference: string,
	branch: string,
	file: string,
) {
	const [owner, repository] = repositoryReference.split("/");
	return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}/${file}`;
}

function integrity(value: z.infer<typeof receiptCoreSchema>) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
