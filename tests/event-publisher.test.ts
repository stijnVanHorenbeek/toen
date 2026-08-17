import { createPrivateKey as importPrivateKey } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	ContentConflictError,
	type GitHubAppConfig,
	type GitHubFetch,
	publishEventDraft,
} from "../src/lib/github/event-publisher";
import {
	githubAppConfigFromEnvironment,
	githubPublishModeFromEnvironment,
} from "../src/lib/github/github-config";

const draft = {
	slug: "val-van-constantinopel-1453",
	title: "Constantinopel valt",
	date: { year: 1453, era: "ce", precision: "day", month: 5, day: 29 },
	summary: "Ottomaanse troepen nemen Constantinopel in.",
	topics: ["politiek", "oorlog"],
	profiles: ["algemeen"],
	sources: [
		{
			title: "Fall of Constantinople",
			publisher: "Britannica",
			url: "https://example.com/source",
		},
	],
	body: "De stad werd na een beleg ingenomen.",
};

const deployHookUrl =
	"https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/hook-id";

async function config(): Promise<GitHubAppConfig> {
	return {
		appId: "12345",
		installationId: "67890",
		privateKey: await createGitHubPrivateKey(),
		owner: "example-owner",
		repository: "toen-content",
		baseBranch: "main",
		deployHookUrl,
	};
}

function sequencedFetch(
	responses: Response[],
	requests: Array<{ url: string; init?: RequestInit }>,
): GitHubFetch {
	return async (url, init) => {
		requests.push({ url: String(url), init });
		const response = responses.shift();
		if (!response) throw new Error("Unexpected GitHub request");
		return response;
	};
}

describe("github configuration", () => {
	it("defaults missing publishing mode to dry-run", async () => {
		await expect(githubPublishModeFromEnvironment({})).resolves.toBe("dry-run");
	});

	it("reads GitHub configuration without requiring legacy deploy hook", async () => {
		const base = {
			GITHUB_APP_ID: "123456",
			GITHUB_APP_INSTALLATION_ID: "789012",
			GITHUB_APP_PRIVATE_KEY: "private-key",
			GITHUB_REPOSITORY: "example-owner/toen-content",
			GITHUB_BASE_BRANCH: "main",
		};
		await expect(githubAppConfigFromEnvironment(base)).resolves.toMatchObject({
			owner: "example-owner",
			repository: "toen-content",
		});
		for (const invalidUrl of [
			"http://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/id",
			"https://api.cloudflare.com:444/client/v4/workers/builds/deploy_hooks/id",
			"https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/id?x=1",
			"https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/id#x",
			"https://example.com/client/v4/workers/builds/deploy_hooks/id",
		]) {
			await expect(
				githubAppConfigFromEnvironment({
					...base,
					CONTENT_DEPLOY_HOOK_URL: invalidUrl,
				}),
			).resolves.toBeNull();
		}
		await expect(
			githubAppConfigFromEnvironment({
				...base,
				CONTENT_DEPLOY_HOOK_URL: deployHookUrl,
			}),
		).resolves.toMatchObject({
			owner: "example-owner",
			repository: "toen-content",
			deployHookUrl,
		});
	});

	it("reads deploy hook URL from Secrets Store", async () => {
		const stored = (value: string) => ({
			get: vi.fn().mockResolvedValue(value),
		});
		const environment = {
			GITHUB_APP_ID_STORE: stored("123456"),
			GITHUB_APP_INSTALLATION_ID_STORE: stored("789012"),
			GITHUB_APP_PRIVATE_KEY_STORE: stored("private-key"),
			GITHUB_REPOSITORY_STORE: stored("example-owner/toen-content"),
			GITHUB_BASE_BRANCH_STORE: stored("main"),
			CONTENT_DEPLOY_HOOK_URL_STORE: stored(deployHookUrl),
		};
		await expect(
			githubAppConfigFromEnvironment(environment),
		).resolves.toMatchObject({ deployHookUrl });
		for (const binding of Object.values(environment))
			expect(binding.get).toHaveBeenCalledOnce();
	});
});

describe("publishEventDraft", () => {
	it("dry-runs without any network access", async () => {
		const githubFetch = vi.fn<GitHubFetch>();
		const deployFetch = vi.fn<typeof fetch>();
		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: null,
			githubFetch,
			deployFetch,
		});
		expect(result.status).toBe("dry-run");
		expect(githubFetch).not.toHaveBeenCalled();
		expect(deployFetch).not.toHaveBeenCalled();
	});

	it("creates missing Markdown in the configured content repository and triggers deployment", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const githubFetch = sequencedFetch(
			[
				Response.json({ token: "installation-token" }),
				Response.json({ object: { sha: "base-sha" } }),
				Response.json({}, { status: 404 }),
				Response.json({ commit: { sha: "commit-sha" } }, { status: 201 }),
			],
			requests,
		);
		const deployFetch = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 202 }));
		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: await config(),
			githubFetch,
			deployFetch,
		});

		expect(result).toMatchObject({
			status: "committed-and-triggered",
			change: "created",
			commitSha: "commit-sha",
		});
		expect(deployFetch).toHaveBeenCalledWith(deployHookUrl, { method: "POST" });
		expect(requests[0]?.url).toContain(
			"/app/installations/67890/access_tokens",
		);
		expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
			repositories: ["toen-content"],
			permissions: { contents: "write" },
		});
		expect(requests.slice(1).map(({ url }) => url)).toEqual([
			"https://api.github.com/repos/example-owner/toen-content/git/ref/heads/main",
			"https://api.github.com/repos/example-owner/toen-content/contents/content/events/constantinopel-valt-1453.md?ref=base-sha",
			"https://api.github.com/repos/example-owner/toen-content/contents/content/events/constantinopel-valt-1453.md",
		]);
		const body = JSON.parse(String(requests[3]?.init?.body));
		expect(body).not.toHaveProperty("sha");
		expect(body.branch).toBe("main");
		expect(body.message).toContain("Editor: editor@example.com");
		expect(Buffer.from(body.content, "base64").toString("utf8")).toContain(
			"title: Constantinopel valt",
		);
		expect(new Headers(requests[3]?.init?.headers).get("Authorization")).toBe(
			"Bearer installation-token",
		);
	});

	it("pins returned content SHA into exact release coordination", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const contentCommitSha = "b".repeat(40);
		const buildUuid = "123e4567-e89b-42d3-a456-426614174000";
		const githubFetch = sequencedFetch(
			[
				Response.json({ token: "installation-token" }),
				Response.json({ object: { sha: "a".repeat(40) } }),
				Response.json({}, { status: 404 }),
				Response.json({ commit: { sha: contentCommitSha } }, { status: 201 }),
			],
			requests,
		);
		const releaseCoordinator = vi.fn().mockResolvedValue({
			status: "building",
			buildUuid,
			releaseRequestCommitSha: "c".repeat(40),
		});
		const releaseConfig = {
			accountId: "d".repeat(32),
			apiToken: "token-value-long-enough",
			applicationSha: "e".repeat(40),
			triggerUuid: "223e4567-e89b-42d3-a456-426614174000",
			workerTag: "f".repeat(32),
		};
		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: await config(),
			githubFetch,
			pipelineMode: "exact",
			releaseConfig,
			releaseCoordinator,
		});
		expect(result).toMatchObject({
			status: "building",
			buildUuid,
			commitSha: contentCommitSha,
		});
		expect(releaseCoordinator).toHaveBeenCalledWith(
			expect.objectContaining({
				appSha: releaseConfig.applicationSha,
				contentSha: contentCommitSha,
			}),
		);
	});

	it("refuses to overwrite differing existing Markdown from the create flow", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const deployFetch = vi.fn<typeof fetch>();
		const githubFetch = sequencedFetch(
			[
				Response.json({ token: "installation-token" }),
				Response.json({ object: { sha: "snapshot-sha" } }),
				Response.json({
					content: Buffer.from("newer content").toString("base64"),
					encoding: "base64",
					sha: "blob-sha",
				}),
			],
			requests,
		);

		await expect(
			publishEventDraft({
				draft,
				editor: "editor@example.com",
				config: await config(),
				githubFetch,
				deployFetch,
			}),
		).rejects.toBeInstanceOf(ContentConflictError);
		expect(requests.map(({ init }) => init?.method)).toEqual([
			"POST",
			"GET",
			"GET",
		]);
		expect(deployFetch).not.toHaveBeenCalled();
	});

	it("reads identical Markdown at one immutable snapshot and retriggers deployment", async () => {
		const preview = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: null,
		});
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const githubFetch = sequencedFetch(
			[
				Response.json({ token: "installation-token" }),
				Response.json({ object: { sha: "snapshot-sha" } }),
				Response.json({
					content: Buffer.from(preview.markdown).toString("base64"),
					encoding: "base64",
					sha: "blob-sha",
				}),
			],
			requests,
		);
		const deployFetch = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 200 }));
		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: await config(),
			githubFetch,
			deployFetch,
		});

		expect(result).toMatchObject({
			status: "committed-and-triggered",
			change: "unchanged",
			commitSha: "snapshot-sha",
		});
		expect(requests[2]?.url).toContain("?ref=snapshot-sha");
		expect(deployFetch).toHaveBeenCalledOnce();
	});

	it("returns partial success when deploy hook fails so retry can retrigger", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const githubFetch = sequencedFetch(
			[
				Response.json({ token: "installation-token" }),
				Response.json({ object: { sha: "base-sha" } }),
				Response.json({}, { status: 404 }),
				Response.json({ commit: { sha: "commit-sha" } }, { status: 201 }),
			],
			requests,
		);
		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: await config(),
			githubFetch,
			deployFetch: vi
				.fn()
				.mockResolvedValue(new Response(null, { status: 500 })),
		});
		expect(result).toMatchObject({
			status: "committed-trigger-failed",
			change: "created",
			commitSha: "commit-sha",
		});
	});

	it("reconciles a concurrent identical write and rejects a differing conflict", async () => {
		const preview = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: null,
		});
		const common = [
			Response.json({ token: "installation-token" }),
			Response.json({ object: { sha: "base-sha" } }),
			Response.json({}, { status: 404 }),
			Response.json({}, { status: 409 }),
			Response.json({ object: { sha: "winner-sha" } }),
		];
		const identicalFetch = sequencedFetch(
			[
				...common,
				Response.json({
					content: Buffer.from(preview.markdown).toString("base64"),
					encoding: "base64",
					sha: "new-blob",
				}),
			],
			[],
		);
		await expect(
			publishEventDraft({
				draft,
				editor: "editor@example.com",
				config: await config(),
				githubFetch: identicalFetch,
				deployFetch: vi
					.fn()
					.mockResolvedValue(new Response(null, { status: 200 })),
			}),
		).resolves.toMatchObject({ change: "unchanged", commitSha: "winner-sha" });

		const differingFetch = sequencedFetch(
			[
				Response.json({ token: "installation-token" }),
				Response.json({ object: { sha: "base-sha" } }),
				Response.json({}, { status: 404 }),
				Response.json({}, { status: 422 }),
				Response.json({ object: { sha: "winner-sha" } }),
				Response.json({
					content: Buffer.from("other editor").toString("base64"),
					encoding: "base64",
					sha: "new-blob",
				}),
			],
			[],
		);
		await expect(
			publishEventDraft({
				draft,
				editor: "editor@example.com",
				config: await config(),
				githubFetch: differingFetch,
			}),
		).rejects.toBeInstanceOf(ContentConflictError);
	});
});

async function createGitHubPrivateKey(): Promise<string> {
	const keys = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);
	const key = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
	return importPrivateKey({
		key: Buffer.from(key),
		format: "der",
		type: "pkcs8",
	})
		.export({ format: "pem", type: "pkcs1" })
		.toString();
}
