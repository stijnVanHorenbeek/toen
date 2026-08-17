import { createHash } from "node:crypto";
import { z } from "zod";

const shaPattern = /^[0-9a-f]{40}$/;
const buildUuidSchema = z.uuid();
const coreSchema = z.strictObject({
	kind: z.literal("toen-release-request"),
	schemaVersion: z.literal(1),
	buildUuid: buildUuidSchema,
	appSha: z.string().regex(shaPattern),
	contentSha: z.string().regex(shaPattern),
});
export const releaseRequestSchema = coreSchema.extend({
	integritySha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export type ReleaseRequest = z.infer<typeof releaseRequestSchema>;

export function createReleaseRequest({
	appSha,
	buildUuid,
	contentSha,
}: {
	appSha: string;
	buildUuid: string;
	contentSha: string;
}): ReleaseRequest {
	const core = coreSchema.parse({
		kind: "toen-release-request",
		schemaVersion: 1,
		buildUuid,
		appSha,
		contentSha,
	});
	return {
		...core,
		integritySha256: integrity(core),
	};
}

export function parseReleaseRequest(value: string): ReleaseRequest {
	const parsed = releaseRequestSchema.parse(JSON.parse(value));
	const { integritySha256, ...core } = parsed;
	if (integrity(core) !== integritySha256) {
		throw new Error("Release request integrity check failed");
	}
	return parsed;
}

export function serializeReleaseRequest(request: ReleaseRequest): string {
	const parsed = parseReleaseRequest(JSON.stringify(request));
	return `${JSON.stringify(parsed)}\n`;
}

export function releaseRequestPath(buildUuid: string): string {
	return `.toen/releases/requests/${buildUuidSchema.parse(buildUuid)}.json`;
}

function integrity(core: z.infer<typeof coreSchema>): string {
	return createHash("sha256").update(JSON.stringify(core)).digest("hex");
}
