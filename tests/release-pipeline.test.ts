import { describe, expect, it, vi } from "vitest";
import {
	CloudflareBuildsClient,
	isLatestReleaseBuild,
	mapReleaseBuildState,
} from "../src/lib/release/cloudflare-builds";
import { coordinateExactRelease } from "../src/lib/release/release-coordinator";
import {
	createReleaseRequest,
	parseReleaseRequest,
	releaseRequestPath,
} from "../src/lib/release/release-request";

const appSha = "a".repeat(40);
const contentSha = "b".repeat(40);
const buildUuid = "123e4567-e89b-42d3-a456-426614174000";
const config = {
	accountId: "c".repeat(32),
	apiToken: "token-value-long-enough",
	applicationSha: appSha,
	triggerUuid: "223e4567-e89b-42d3-a456-426614174000",
	workerTag: "d".repeat(32),
};

describe("exact release requests", () => {
	it("hashes and validates an immutable build/content correlation record", () => {
		const request = createReleaseRequest({ appSha, buildUuid, contentSha });
		expect(parseReleaseRequest(`${JSON.stringify(request)}\n`)).toEqual(
			request,
		);
		expect(releaseRequestPath(buildUuid)).toBe(
			`.toen/releases/requests/${buildUuid}.json`,
		);
		expect(() =>
			parseReleaseRequest(
				JSON.stringify({ ...request, contentSha: "e".repeat(40) }),
			),
		).toThrow("integrity");
	});

	it("triggers only the configured exact application SHA", async () => {
		const fetch = vi.fn().mockResolvedValue(
			Response.json({
				success: true,
				errors: [],
				messages: [],
				result: { build_uuid: buildUuid, created_on: "2026-08-17T20:00:00Z" },
			}),
		);
		const client = new CloudflareBuildsClient(config, fetch);
		await expect(client.trigger()).resolves.toEqual({ buildUuid });
		expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({
			commit_hash: appSha,
		});
	});

	it("maps building, activated, failed, and superseded states", () => {
		const current = {
			buildUuid,
			createdOn: "2026-08-17T20:00:00Z",
			status: "running" as const,
			buildOutcome: null,
			triggerUuid: config.triggerUuid,
			commitHash: appSha,
		};
		expect(mapReleaseBuildState(buildUuid, [current], config)).toBe("building");
		expect(
			mapReleaseBuildState(
				buildUuid,
				[{ ...current, status: "stopped", buildOutcome: "success" }],
				config,
			),
		).toBe("activated");
		expect(
			mapReleaseBuildState(
				buildUuid,
				[{ ...current, status: "stopped", buildOutcome: "fail" }],
				config,
			),
		).toBe("failed");
		const supersededBuilds = [
			current,
			{
				...current,
				buildUuid: "323e4567-e89b-42d3-a456-426614174000",
				createdOn: "2026-08-17T20:01:00Z",
			},
		];
		expect(mapReleaseBuildState(buildUuid, supersededBuilds, config)).toBe(
			"superseded",
		);
		expect(isLatestReleaseBuild(buildUuid, supersededBuilds, config)).toBe(
			false,
		);
	});

	it("uses distinct immutable correlation paths for duplicate retries", async () => {
		const firstBuild = "123e4567-e89b-42d3-a456-426614174000";
		const secondBuild = "323e4567-e89b-42d3-a456-426614174000";
		const trigger = vi
			.fn()
			.mockResolvedValueOnce({ buildUuid: firstBuild })
			.mockResolvedValueOnce({ buildUuid: secondBuild });
		const paths: string[] = [];
		const writeReleaseRequest = vi.fn(async ({ path }: { path: string }) => {
			paths.push(path);
			return { change: "created" as const, commitSha: "f".repeat(40) };
		});
		for (let index = 0; index < 2; index += 1) {
			await coordinateExactRelease({
				appSha,
				contentSha,
				trigger,
				writeReleaseRequest,
			});
		}
		expect(paths).toEqual([
			releaseRequestPath(firstBuild),
			releaseRequestPath(secondBuild),
		]);
	});

	it("reports building only after trigger and correlation record succeed", async () => {
		const trigger = vi.fn().mockResolvedValue({ buildUuid });
		const writeReleaseRequest = vi
			.fn()
			.mockResolvedValue({ change: "created", commitSha: "f".repeat(40) });
		await expect(
			coordinateExactRelease({
				appSha,
				contentSha,
				trigger,
				writeReleaseRequest,
			}),
		).resolves.toMatchObject({ status: "building", buildUuid });
		expect(writeReleaseRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				path: releaseRequestPath(buildUuid),
			}),
		);

		trigger.mockRejectedValueOnce(new Error("trigger failed"));
		await expect(
			coordinateExactRelease({
				appSha,
				contentSha,
				trigger,
				writeReleaseRequest,
			}),
		).resolves.toMatchObject({
			status: "committed",
			reason: "build-trigger-failed",
		});
	});
});
