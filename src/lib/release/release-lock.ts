import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { GitHubRepository } from "../github/github-repository";
import type { CloudflareBuildsClient } from "./cloudflare-builds";

export const releaseActivationLockPath = ".toen/releases/activation-lock.json";
const common = {
	kind: z.literal("toen-release-activation-lock"),
	schemaVersion: z.literal(1),
	ownerId: z.uuid(),
	appSha: z.string().regex(/^[0-9a-f]{40}$/),
	contentSha: z.string().regex(/^[0-9a-f]{40}$/),
};
const triggeringCoreSchema = z.strictObject({
	...common,
	state: z.literal("triggering"),
	expiresAt: z.iso.datetime(),
});
const activeCoreSchema = z.strictObject({
	...common,
	state: z.literal("active"),
	buildUuid: z.uuid(),
});
const releasedCoreSchema = z.strictObject({
	...common,
	state: z.literal("released"),
});
const coreSchema = z.discriminatedUnion("state", [
	triggeringCoreSchema,
	activeCoreSchema,
	releasedCoreSchema,
]);
const integritySha256 = z.string().regex(/^[0-9a-f]{64}$/);
const lockSchema = z.discriminatedUnion("state", [
	triggeringCoreSchema.extend({ integritySha256 }),
	activeCoreSchema.extend({ integritySha256 }),
	releasedCoreSchema.extend({ integritySha256 }),
]);

export type ReleaseActivationLock = z.infer<typeof lockSchema>;
export type ReleaseLockLease = {
	ownerId: string;
	blobSha: string;
	lock: ReleaseActivationLock;
};

export function createReleaseActivationLock(
	value:
		| {
				state: "triggering";
				ownerId: string;
				appSha: string;
				contentSha: string;
				expiresAt: string;
		  }
		| {
				state: "released";
				ownerId: string;
				appSha: string;
				contentSha: string;
		  }
		| {
				state: "active";
				ownerId: string;
				appSha: string;
				contentSha: string;
				buildUuid: string;
		  },
): ReleaseActivationLock {
	const core = coreSchema.parse({
		kind: "toen-release-activation-lock",
		schemaVersion: 1,
		...value,
	});
	return { ...core, integritySha256: integrity(core) } as ReleaseActivationLock;
}

export function parseReleaseActivationLock(
	value: string,
): ReleaseActivationLock {
	const parsed = lockSchema.parse(JSON.parse(value));
	const { integritySha256, ...core } = parsed;
	if (integrity(core) !== integritySha256) {
		throw new Error("Release activation lock integrity check failed");
	}
	return parsed;
}

export function serializeReleaseActivationLock(lock: ReleaseActivationLock) {
	return `${JSON.stringify(parseReleaseActivationLock(JSON.stringify(lock)))}\n`;
}

export async function acquireReleaseActivationLock({
	appSha,
	builds,
	contentSha,
	now = () => new Date(),
	ownerId = randomUUID(),
	repository,
}: {
	appSha: string;
	builds: CloudflareBuildsClient;
	contentSha: string;
	now?: () => Date;
	ownerId?: string;
	repository: GitHubRepository;
}): Promise<ReleaseLockLease | null> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const current = await repository.readTextFile(releaseActivationLockPath);
		if (current) {
			const lock = parseReleaseActivationLock(current.content);
			if (
				lock.state === "triggering" &&
				Date.parse(lock.expiresAt) > now().getTime()
			) {
				return null;
			}
			if (lock.state === "active") {
				const ownedBuild = (await builds.list()).find(
					(build) => build.buildUuid === lock.buildUuid,
				);
				if (ownedBuild?.status !== "stopped") return null;
			}
			const replacement = triggeringLock({
				appSha,
				contentSha,
				now: now(),
				ownerId,
			});
			try {
				await repository.replaceFile({
					content: serializeReleaseActivationLock(replacement),
					expectedBlobSha: current.blobSha,
					message: "chore(release): acquire activation lock",
					path: releaseActivationLockPath,
				});
			} catch {
				continue;
			}
		} else {
			const created = triggeringLock({
				appSha,
				contentSha,
				now: now(),
				ownerId,
			});
			try {
				await repository.upsertFile({
					content: serializeReleaseActivationLock(created),
					message: "chore(release): acquire activation lock",
					path: releaseActivationLockPath,
				});
			} catch {
				continue;
			}
		}
		const acquired = await repository.readTextFile(releaseActivationLockPath);
		if (!acquired) continue;
		const lock = parseReleaseActivationLock(acquired.content);
		if (lock.ownerId === ownerId && lock.state === "triggering") {
			return { ownerId, blobSha: acquired.blobSha, lock };
		}
	}
	return null;
}

export async function activateReleaseLock({
	buildUuid,
	lease,
	repository,
}: {
	buildUuid: string;
	lease: ReleaseLockLease;
	repository: GitHubRepository;
}): Promise<ReleaseLockLease> {
	const active = createReleaseActivationLock({
		state: "active",
		ownerId: lease.ownerId,
		appSha: lease.lock.appSha,
		contentSha: lease.lock.contentSha,
		buildUuid,
	});
	await repository.replaceFile({
		content: serializeReleaseActivationLock(active),
		expectedBlobSha: lease.blobSha,
		message: `chore(release): bind activation lock ${buildUuid}`,
		path: releaseActivationLockPath,
	});
	const updated = await repository.readTextFile(releaseActivationLockPath);
	if (!updated) throw new Error("Release activation lock disappeared");
	const lock = parseReleaseActivationLock(updated.content);
	if (lock.state !== "active" || lock.ownerId !== lease.ownerId) {
		throw new Error("Release activation lock ownership changed");
	}
	return { ownerId: lease.ownerId, blobSha: updated.blobSha, lock };
}

export async function releaseLock({
	lease,
	repository,
}: {
	lease: ReleaseLockLease;
	repository: GitHubRepository;
}) {
	const released = createReleaseActivationLock({
		state: "released",
		ownerId: lease.ownerId,
		appSha: lease.lock.appSha,
		contentSha: lease.lock.contentSha,
	});
	await repository.replaceFile({
		content: serializeReleaseActivationLock(released),
		expectedBlobSha: lease.blobSha,
		message: "chore(release): release activation lock",
		path: releaseActivationLockPath,
	});
}

function triggeringLock({
	appSha,
	contentSha,
	now,
	ownerId,
}: {
	appSha: string;
	contentSha: string;
	now: Date;
	ownerId: string;
}) {
	return createReleaseActivationLock({
		state: "triggering",
		ownerId,
		appSha,
		contentSha,
		expiresAt: new Date(now.getTime() + 5 * 60 * 1_000).toISOString(),
	});
}

function integrity(value: z.infer<typeof coreSchema>) {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
