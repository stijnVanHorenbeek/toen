import { describe, expect, it } from "vitest";
import {
	exactReleaseBuildConfigFromEnvironment,
	releasePipelineModeFromEnvironment,
} from "../src/lib/release/release-build-config";

const exactEnvironment = {
	RELEASE_PIPELINE_MODE: "exact" as const,
	CLOUDFLARE_BUILDS_API_TOKEN: "token-value-long-enough",
	CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
	CLOUDFLARE_BUILD_TRIGGER_UUID: "123e4567-e89b-42d3-a456-426614174000",
	CLOUDFLARE_WORKER_TAG: "b".repeat(32),
	RELEASE_APPLICATION_SHA: "c".repeat(40),
};

describe("release build configuration", () => {
	it("keeps legacy reader mode until exact pipeline is explicitly enabled", async () => {
		await expect(releasePipelineModeFromEnvironment({})).resolves.toBe(
			"legacy",
		);
		await expect(
			releasePipelineModeFromEnvironment(exactEnvironment),
		).resolves.toBe("exact");
	});

	it("loads a complete exact-SHA build configuration", async () => {
		await expect(
			exactReleaseBuildConfigFromEnvironment(exactEnvironment),
		).resolves.toEqual({
			apiToken: exactEnvironment.CLOUDFLARE_BUILDS_API_TOKEN,
			accountId: exactEnvironment.CLOUDFLARE_ACCOUNT_ID,
			triggerUuid: exactEnvironment.CLOUDFLARE_BUILD_TRIGGER_UUID,
			workerTag: exactEnvironment.CLOUDFLARE_WORKER_TAG,
			applicationSha: exactEnvironment.RELEASE_APPLICATION_SHA,
		});
	});

	it("fails closed for partial or malformed exact configuration", async () => {
		await expect(
			exactReleaseBuildConfigFromEnvironment({
				...exactEnvironment,
				RELEASE_APPLICATION_SHA: "main",
			}),
		).resolves.toBeNull();
		await expect(
			exactReleaseBuildConfigFromEnvironment({
				RELEASE_PIPELINE_MODE: "exact",
			}),
		).resolves.toBeNull();
	});
});
