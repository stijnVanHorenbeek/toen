import { describe, expect, it, vi } from "vitest";
import { handleReleaseStatusRequest } from "../src/lib/admin/release-status-handler";

const buildUuid = "123e4567-e89b-42d3-a456-426614174000";
const triggerUuid = "223e4567-e89b-42d3-a456-426614174000";
const appSha = "a".repeat(40);
const environment = {
	ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
	ACCESS_POLICY_AUD: "audience",
	RELEASE_PIPELINE_MODE: "exact" as const,
	CLOUDFLARE_BUILDS_API_TOKEN: "token-value-long-enough",
	CLOUDFLARE_ACCOUNT_ID: "b".repeat(32),
	CLOUDFLARE_BUILD_TRIGGER_UUID: triggerUuid,
	CLOUDFLARE_WORKER_TAG: "c".repeat(32),
	RELEASE_APPLICATION_SHA: appSha,
};
const authenticate = vi.fn().mockResolvedValue({ email: "editor@example.com" });

describe("release status handler", () => {
	it("reports activated only for successful exact build", async () => {
		const buildFetch = vi.fn().mockResolvedValue(
			Response.json({
				success: true,
				result: [build("stopped", "success")],
			}),
		);
		const response = await handleReleaseStatusRequest(request(), environment, {
			authenticate,
			buildFetch,
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		await expect(response.json()).resolves.toEqual({
			status: "activated",
			buildUuid,
			applicationSha: appSha,
		});
	});

	it("rejects unknown fields and unavailable configuration", async () => {
		const unknown = await handleReleaseStatusRequest(
			request({ buildUuid, extra: true }),
			environment,
			{ authenticate, buildFetch: vi.fn() },
		);
		expect(unknown.status).toBe(400);
		const unavailable = await handleReleaseStatusRequest(
			request(),
			{
				ACCESS_TEAM_DOMAIN: environment.ACCESS_TEAM_DOMAIN,
				ACCESS_POLICY_AUD: environment.ACCESS_POLICY_AUD,
			},
			{ authenticate, buildFetch: vi.fn() },
		);
		expect(unavailable.status).toBe(503);
	});
});

function request(body: unknown = { buildUuid }) {
	return new Request("https://example.com/api/admin/releases/status", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "https://example.com",
		},
		body: JSON.stringify(body),
	});
}

function build(
	status: "queued" | "initializing" | "running" | "stopped",
	buildOutcome: "success" | "fail" | null,
) {
	return {
		build_uuid: buildUuid,
		created_on: "2026-08-17T20:00:00Z",
		status,
		build_outcome: buildOutcome,
		trigger: { trigger_uuid: triggerUuid },
		build_trigger_metadata: { commit_hash: appSha },
	};
}
