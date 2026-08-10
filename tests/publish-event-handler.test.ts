import { describe, expect, it, vi } from "vitest";
import { handlePublishEventRequest } from "../src/lib/admin/publish-event-handler";
import {
	ContentConflictError,
	type GitHubFetch,
} from "../src/lib/github/event-publisher";

const accessEnvironment = {
	ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
	ACCESS_POLICY_AUD: "application-audience",
};
const liveEnvironment = {
	...accessEnvironment,
	GITHUB_PUBLISH_MODE: "live" as const,
	GITHUB_APP_ID: "123456",
	GITHUB_APP_INSTALLATION_ID: "789012",
	GITHUB_APP_PRIVATE_KEY: "private-key",
	GITHUB_REPOSITORY: "example-owner/toen-content",
	GITHUB_BASE_BRANCH: "main",
	CONTENT_DEPLOY_HOOK_URL:
		"https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/hook-id",
};
const draft = {
	slug: "val-van-constantinopel-1453",
	title: "Constantinopel valt",
	date: {
		year: 1453,
		era: "ce",
		precision: "day",
		month: 5,
		day: 29,
	},
	summary: "Ottomaanse troepen nemen Constantinopel in.",
	topics: ["politiek"],
	profiles: ["algemeen"],
	sources: [
		{
			title: "Fall of Constantinople",
			publisher: "Encyclopaedia Britannica",
			url: "https://www.britannica.com/event/Fall-of-Constantinople-1453",
		},
	],
	body: "De stad werd na een beleg ingenomen.",
};

describe("handlePublishEventRequest", () => {
	it("fails closed when Access configuration is missing", async () => {
		const authenticate = vi.fn();
		const publish = vi.fn();

		const response = await handlePublishEventRequest(
			createRequest(draft),
			{},
			{ authenticate, publish },
		);

		expect(response.status).toBe(503);
		expect(authenticate).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it("fails closed when the Access team domain is malformed", async () => {
		const authenticate = vi.fn();
		const publish = vi.fn();

		const response = await handlePublishEventRequest(
			createRequest(draft),
			{
				ACCESS_TEAM_DOMAIN: "not-a-url",
				ACCESS_POLICY_AUD: "application-audience",
			},
			{ authenticate, publish },
		);

		expect(response.status).toBe(503);
		expect(authenticate).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it("returns a controlled error when Access vault reads fail", async () => {
		const authenticate = vi.fn();
		const publish = vi.fn();
		const failedBinding = {
			get: vi.fn().mockRejectedValue(new Error("vault unavailable")),
		};

		const response = await handlePublishEventRequest(
			createRequest(draft),
			{
				ACCESS_TEAM_DOMAIN_STORE: failedBinding,
				ACCESS_POLICY_AUD_STORE: failedBinding,
			},
			{ authenticate, publish },
		);

		expect(response.status).toBe(503);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(authenticate).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it("does not publish when Access identity is invalid", async () => {
		const authenticate = vi.fn().mockResolvedValue(null);
		const publish = vi.fn();

		const response = await handlePublishEventRequest(
			createRequest(draft),
			accessEnvironment,
			{ authenticate, publish },
		);

		expect(response.status).toBe(401);
		expect(publish).not.toHaveBeenCalled();
	});

	it("rejects JSON prefix media types", async () => {
		const authenticate = vi
			.fn()
			.mockResolvedValue({ email: "editor@example.com" });
		const publish = vi.fn();
		const request = createRequest(draft);
		request.headers.set("Content-Type", "application/jsonp");

		const response = await handlePublishEventRequest(
			request,
			accessEnvironment,
			{ authenticate, publish },
		);

		expect(response.status).toBe(415);
		expect(publish).not.toHaveBeenCalled();
	});

	it("fails closed when live GitHub configuration is incomplete", async () => {
		const authenticate = vi
			.fn()
			.mockResolvedValue({ email: "editor@example.com" });
		const publish = vi.fn();

		const response = await handlePublishEventRequest(
			createRequest(draft),
			{ ...accessEnvironment, GITHUB_PUBLISH_MODE: "live" },
			{ authenticate, publish },
		);

		expect(response.status).toBe(503);
		expect(publish).not.toHaveBeenCalled();
	});

	it("forces dry-run when complete live credentials are also present", async () => {
		const authenticate = vi
			.fn()
			.mockResolvedValue({ email: "editor@example.com" });
		const publish = vi.fn().mockResolvedValue({
			status: "dry-run",
			path: "content/events/test.md",
			markdown: "document",
		});

		const response = await handlePublishEventRequest(
			createRequest(draft),
			{ ...liveEnvironment, GITHUB_PUBLISH_MODE: "dry-run" },
			{ authenticate, publish },
		);

		expect(response.status).toBe(200);
		expect(publish).toHaveBeenCalledWith(
			expect.objectContaining({ config: null }),
		);
	});

	it.each([
		["committed-and-triggered", "created", 201],
		["committed-and-triggered", "unchanged", 200],
		["committed-trigger-failed", "created", 202],
	])("maps %s %s to HTTP %i", async (status, change, expectedStatus) => {
		const authenticate = vi
			.fn()
			.mockResolvedValue({ email: "editor@example.com" });
		const publish = vi.fn().mockResolvedValue({
			status,
			change,
			path: "content/events/test.md",
			markdown: "document",
			commitSha: "commit-sha",
			commitUrl:
				"https://github.com/example-owner/toen-content/commit/commit-sha",
		});
		const deployFetch = vi.fn<typeof fetch>();

		const response = await handlePublishEventRequest(
			createRequest(draft),
			liveEnvironment,
			{ authenticate, publish, deployFetch },
		);

		expect(response.status).toBe(expectedStatus);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(publish).toHaveBeenCalledWith(
			expect.objectContaining({ deployFetch }),
		);
	});

	it("maps a concurrent content conflict to no-store 409", async () => {
		const authenticate = vi
			.fn()
			.mockResolvedValue({ email: "editor@example.com" });
		const publish = vi
			.fn()
			.mockRejectedValue(new ContentConflictError("content/events/test.md"));

		const response = await handlePublishEventRequest(
			createRequest(draft),
			liveEnvironment,
			{ authenticate, publish },
		);

		expect(response.status).toBe(409);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("returns a dry run when GitHub App credentials are missing", async () => {
		const githubFetch = vi.fn<GitHubFetch>();
		const authenticate = vi
			.fn()
			.mockResolvedValue({ email: "editor@example.com" });

		const response = await handlePublishEventRequest(
			createRequest(draft),
			accessEnvironment,
			{ authenticate, githubFetch },
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			status: "dry-run",
			path: "content/events/val-van-constantinopel-1453.md",
		});
		expect(githubFetch).not.toHaveBeenCalled();
	});
});

function createRequest(body: unknown): Request {
	return new Request("https://example.com/api/admin/events/publish", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}
