import { describe, expect, it, vi } from "vitest";
import type { GitHubRepository } from "../src/lib/github/github-repository";
import type { CloudflareBuildsClient } from "../src/lib/release/cloudflare-builds";
import { coordinateLockedExactRelease } from "../src/lib/release/release-coordinator";
import {
	acquireReleaseActivationLock,
	activateReleaseLock,
	createReleaseActivationLock,
	parseReleaseActivationLock,
	releaseActivationLockPath,
} from "../src/lib/release/release-lock";

const config = {
	accountId: "a".repeat(32),
	apiToken: "token-value-long-enough",
	applicationSha: "b".repeat(40),
	triggerUuid: "123e4567-e89b-42d3-a456-426614174000",
	workerTag: "c".repeat(32),
};
const contentSha = "d".repeat(40);
const buildUuid = "223e4567-e89b-42d3-a456-426614174000";

describe("release activation lock", () => {
	it("integrity-checks strict lock records", () => {
		const lock = createReleaseActivationLock({
			state: "active",
			ownerId: "323e4567-e89b-42d3-a456-426614174000",
			appSha: config.applicationSha,
			contentSha,
			buildUuid,
		});
		expect(parseReleaseActivationLock(JSON.stringify(lock))).toEqual(lock);
		expect(() =>
			parseReleaseActivationLock(
				JSON.stringify({ ...lock, contentSha: "e".repeat(40) }),
			),
		).toThrow("integrity");
	});

	it("reports committed content when lock storage is unavailable", async () => {
		const repository = {
			readTextFile: vi.fn().mockRejectedValue(new Error("GitHub unavailable")),
		} as unknown as GitHubRepository;
		const builds = {} as CloudflareBuildsClient;
		await expect(
			coordinateLockedExactRelease({
				appSha: config.applicationSha,
				builds,
				contentSha,
				repository,
			}),
		).resolves.toEqual({
			status: "committed",
			reason: "release-lock-failed",
		});
	});

	it("serializes triggering and active build ownership", async () => {
		let stored: { content: string; blobSha: string; commitSha: string } | null =
			null;
		let generation = 0;
		const repository = {
			readTextFile: vi.fn(async () => stored),
			upsertFile: vi.fn(async (input: { content: string; path: string }) => {
				expect(input.path).toBe(releaseActivationLockPath);
				generation += 1;
				stored = {
					content: input.content,
					blobSha: `blob-${generation}`,
					commitSha: `commit-${generation}`,
				};
				return { change: "created" as const, commitSha: stored.commitSha };
			}),
			replaceFile: vi.fn(
				async (input: { content: string; expectedBlobSha: string }) => {
					if (!stored || input.expectedBlobSha !== stored.blobSha) {
						throw new Error("conflict");
					}
					generation += 1;
					stored = {
						content: input.content,
						blobSha: `blob-${generation}`,
						commitSha: `commit-${generation}`,
					};
					return { commitSha: stored.commitSha };
				},
			),
		} as unknown as GitHubRepository;
		const listBuilds = vi.fn().mockResolvedValue([]);
		const builds = { list: listBuilds } as unknown as CloudflareBuildsClient;
		const ownerId = "423e4567-e89b-42d3-a456-426614174000";
		const lease = await acquireReleaseActivationLock({
			appSha: config.applicationSha,
			builds,
			contentSha,
			now: () => new Date("2026-08-17T20:00:00.000Z"),
			ownerId,
			repository,
		});
		expect(lease?.ownerId).toBe(ownerId);
		if (!lease) throw new Error("Expected release lock lease");
		await expect(
			acquireReleaseActivationLock({
				appSha: config.applicationSha,
				builds,
				contentSha,
				now: () => new Date("2026-08-17T20:01:00.000Z"),
				ownerId: "523e4567-e89b-42d3-a456-426614174000",
				repository,
			}),
		).resolves.toBeNull();
		const active = await activateReleaseLock({
			buildUuid,
			lease,
			repository,
		});
		expect(active.lock).toMatchObject({ state: "active", buildUuid, ownerId });
		listBuilds.mockResolvedValue([
			{
				buildUuid,
				createdOn: "2026-08-17T20:00:00Z",
				status: "running",
				buildOutcome: null,
				triggerUuid: "723e4567-e89b-42d3-a456-426614174000",
				commitHash: "e".repeat(40),
			},
		]);
		await expect(
			acquireReleaseActivationLock({
				appSha: config.applicationSha,
				builds,
				contentSha,
				ownerId: "623e4567-e89b-42d3-a456-426614174000",
				repository,
			}),
		).resolves.toBeNull();
		listBuilds.mockResolvedValue([]);
		await expect(
			acquireReleaseActivationLock({
				appSha: config.applicationSha,
				builds,
				contentSha,
				now: () => new Date("2030-08-17T20:00:00.000Z"),
				ownerId: "723e4567-e89b-42d3-a456-426614174000",
				repository,
			}),
		).resolves.toBeNull();
		listBuilds.mockResolvedValue([
			{
				buildUuid,
				createdOn: "2026-08-17T20:00:00Z",
				status: "stopped",
				buildOutcome: "fail",
				triggerUuid: config.triggerUuid,
				commitHash: config.applicationSha,
			},
		]);
		await expect(
			acquireReleaseActivationLock({
				appSha: config.applicationSha,
				builds,
				contentSha,
				ownerId: "823e4567-e89b-42d3-a456-426614174000",
				repository,
			}),
		).resolves.toMatchObject({
			ownerId: "823e4567-e89b-42d3-a456-426614174000",
		});
	});
});
