import { createPrivateKey as importPrivateKey } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
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
	date: {
		year: 1453,
		era: "ce",
		precision: "day",
		month: 5,
		day: 29,
	},
	summary: "Ottomaanse troepen nemen Constantinopel in.",
	topics: ["politiek", "oorlog"],
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

describe("githubAppConfigFromEnvironment", () => {
	it("returns no write configuration when the private key is missing", async () => {
		await expect(
			githubAppConfigFromEnvironment({
				GITHUB_APP_ID: "123456",
				GITHUB_APP_INSTALLATION_ID: "789012",
				GITHUB_REPOSITORY: "example-owner/toen",
				GITHUB_BASE_BRANCH: "main",
			}),
		).resolves.toBeNull();
	});

	it("reads live publishing mode from Secrets Store", async () => {
		const get = vi.fn().mockResolvedValue("live");

		await expect(
			githubPublishModeFromEnvironment({
				GITHUB_PUBLISH_MODE_STORE: { get },
			}),
		).resolves.toBe("live");
		expect(get).toHaveBeenCalledOnce();
	});

	it("reads all GitHub configuration from Secrets Store bindings", async () => {
		const stored = (value: string) => ({
			get: vi.fn().mockResolvedValue(value),
		});
		const environment = {
			GITHUB_APP_ID_STORE: stored("123456"),
			GITHUB_APP_INSTALLATION_ID_STORE: stored("789012"),
			GITHUB_APP_PRIVATE_KEY_STORE: stored("private-key"),
			GITHUB_REPOSITORY_STORE: stored("example-owner/toen"),
			GITHUB_BASE_BRANCH_STORE: stored("main"),
		};

		await expect(githubAppConfigFromEnvironment(environment)).resolves.toEqual({
			appId: "123456",
			installationId: "789012",
			privateKey: "private-key",
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		});
		for (const binding of Object.values(environment)) {
			expect(binding.get).toHaveBeenCalledOnce();
		}
	});
});

describe("publishEventDraft", () => {
	it("returns a dry run without network access when App config is missing", async () => {
		const githubFetch = vi.fn<GitHubFetch>();

		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: null,
			githubFetch,
		});

		expect(result.status).toBe("dry-run");
		expect(result.path).toBe("content/events/val-van-constantinopel-1453.md");
		expect(githubFetch).not.toHaveBeenCalled();
	});

	it("creates a branch, Markdown commit, and pull request as the App", async () => {
		const config: GitHubAppConfig = {
			appId: "12345",
			installationId: "67890",
			privateKey: await createGitHubPrivateKey(),
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		};
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const responses = [
			Response.json({ token: "installation-token" }),
			Response.json([]),
			Response.json({}, { status: 404 }),
			Response.json({ object: { sha: "base-sha" } }),
			Response.json({ ref: "refs/heads/content/test" }, { status: 201 }),
			Response.json({}, { status: 404 }),
			Response.json({ commit: { sha: "commit-sha" } }, { status: 201 }),
			Response.json(
				{ number: 17, html_url: "https://github.com/example/toen/pull/17" },
				{ status: 201 },
			),
		];
		const githubFetch: GitHubFetch = async (url, init) => {
			requests.push({ url: String(url), init });
			const response = responses.shift();
			if (!response) throw new Error("Unexpected GitHub request");
			return response;
		};

		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config,
			githubFetch,
			branchSuffix: "test",
		});

		expect(result).toMatchObject({
			status: "created",
			pullRequestNumber: 17,
			pullRequestUrl: "https://github.com/example/toen/pull/17",
			branch: "content/val-van-constantinopel-1453-test",
		});
		expect(requests.map(({ url }) => url)).toEqual([
			"https://api.github.com/app/installations/67890/access_tokens",
			"https://api.github.com/repos/example-owner/toen/pulls?state=open&head=example-owner%3Acontent%2Fval-van-constantinopel-1453-test&base=main",
			"https://api.github.com/repos/example-owner/toen/git/ref/heads/content/val-van-constantinopel-1453-test",
			"https://api.github.com/repos/example-owner/toen/git/ref/heads/main",
			"https://api.github.com/repos/example-owner/toen/git/refs",
			"https://api.github.com/repos/example-owner/toen/contents/content/events/val-van-constantinopel-1453.md?ref=content%2Fval-van-constantinopel-1453-test",
			"https://api.github.com/repos/example-owner/toen/contents/content/events/val-van-constantinopel-1453.md",
			"https://api.github.com/repos/example-owner/toen/pulls",
		]);

		const commitRequest = JSON.parse(String(requests[6]?.init?.body));
		expect(decodeBase64(commitRequest.content)).toContain(
			"title: Constantinopel valt",
		);
		const pullRequest = JSON.parse(String(requests[7]?.init?.body));
		expect(pullRequest.body).toContain("editor@example.com");
	});

	it("returns an existing pull request for the same publish operation", async () => {
		const config: GitHubAppConfig = {
			appId: "12345",
			installationId: "67890",
			privateKey: await createGitHubPrivateKey(),
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		};
		const requests: string[] = [];
		const responses = [
			Response.json({ token: "installation-token" }),
			Response.json([
				{
					number: 17,
					html_url: "https://github.com/example/toen/pull/17",
				},
			]),
		];
		const githubFetch: GitHubFetch = async (url) => {
			requests.push(String(url));
			const response = responses.shift();
			if (!response) throw new Error("Unexpected GitHub request");
			return response;
		};

		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config,
			githubFetch,
			branchSuffix: "test",
		});

		expect(result).toMatchObject({
			status: "created",
			pullRequestNumber: 17,
			pullRequestUrl: "https://github.com/example/toen/pull/17",
			branch: "content/val-van-constantinopel-1453-test",
		});
		expect(requests).toHaveLength(2);
	});

	it("continues a publish after only the branch was created", async () => {
		const config: GitHubAppConfig = {
			appId: "12345",
			installationId: "67890",
			privateKey: await createGitHubPrivateKey(),
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		};
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const responses = [
			Response.json({ token: "installation-token" }),
			Response.json([]),
			Response.json({ object: { sha: "branch-sha" } }),
			Response.json({}, { status: 404 }),
			Response.json({ commit: { sha: "commit-sha" } }, { status: 201 }),
			Response.json(
				{ number: 17, html_url: "https://github.com/example/toen/pull/17" },
				{ status: 201 },
			),
		];
		const githubFetch: GitHubFetch = async (url, init) => {
			requests.push({ url: String(url), init });
			const response = responses.shift();
			if (!response) throw new Error("Unexpected GitHub request");
			return response;
		};

		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config,
			githubFetch,
			branchSuffix: "test",
		});

		expect(result).toMatchObject({ status: "created", pullRequestNumber: 17 });
		expect(requests.map(({ init }) => init?.method)).toEqual([
			"POST",
			"GET",
			"GET",
			"GET",
			"PUT",
			"POST",
		]);
	});

	it("continues a publish after the canonical file was created", async () => {
		const config: GitHubAppConfig = {
			appId: "12345",
			installationId: "67890",
			privateKey: await createGitHubPrivateKey(),
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		};
		const preview = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config: null,
		});
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const responses = [
			Response.json({ token: "installation-token" }),
			Response.json([]),
			Response.json({ object: { sha: "branch-sha" } }),
			Response.json({
				content: Buffer.from(preview.markdown).toString("base64"),
				encoding: "base64",
				sha: "commit-sha",
			}),
			Response.json(
				{ number: 17, html_url: "https://github.com/example/toen/pull/17" },
				{ status: 201 },
			),
		];
		const githubFetch: GitHubFetch = async (url, init) => {
			requests.push({ url: String(url), init });
			const response = responses.shift();
			if (!response) throw new Error("Unexpected GitHub request");
			return response;
		};

		const result = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config,
			githubFetch,
			branchSuffix: "test",
		});

		expect(result).toMatchObject({ status: "created", pullRequestNumber: 17 });
		expect(requests.map(({ init }) => init?.method)).toEqual([
			"POST",
			"GET",
			"GET",
			"GET",
			"POST",
		]);
	});

	it("does not overwrite different content on a retry branch", async () => {
		const config: GitHubAppConfig = {
			appId: "12345",
			installationId: "67890",
			privateKey: await createGitHubPrivateKey(),
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		};
		const responses = [
			Response.json({ token: "installation-token" }),
			Response.json([]),
			Response.json({ object: { sha: "branch-sha" } }),
			Response.json({
				content: Buffer.from("different content").toString("base64"),
				encoding: "base64",
				sha: "commit-sha",
			}),
		];
		const githubFetch: GitHubFetch = async () => {
			const response = responses.shift();
			if (!response) throw new Error("Unexpected GitHub request");
			return response;
		};

		await expect(
			publishEventDraft({
				draft,
				editor: "editor@example.com",
				config,
				githubFetch,
				branchSuffix: "test",
			}),
		).rejects.toThrow("Existing branch content differs");
	});

	it("uses a stable branch for retries of the same content", async () => {
		const config: GitHubAppConfig = {
			appId: "12345",
			installationId: "67890",
			privateKey: await createGitHubPrivateKey(),
			owner: "example-owner",
			repository: "toen",
			baseBranch: "main",
		};
		const responses = [
			Response.json({ token: "installation-token" }),
			Response.json([
				{
					number: 17,
					html_url: "https://github.com/example/toen/pull/17",
				},
			]),
			Response.json({ token: "installation-token" }),
			Response.json([
				{
					number: 17,
					html_url: "https://github.com/example/toen/pull/17",
				},
			]),
		];
		const githubFetch: GitHubFetch = async () => {
			const response = responses.shift();
			if (!response) throw new Error("Unexpected GitHub request");
			return response;
		};

		const first = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config,
			githubFetch,
		});
		const retry = await publishEventDraft({
			draft,
			editor: "editor@example.com",
			config,
			githubFetch,
		});

		expect(first.status).toBe("created");
		expect(retry.status).toBe("created");
		if (first.status !== "created" || retry.status !== "created") {
			throw new Error("Expected created pull requests");
		}
		expect(first.branch).toMatch(
			/^content\/val-van-constantinopel-1453-[a-f0-9]{12}$/,
		);
		expect(retry.branch).toBe(first.branch);
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

function decodeBase64(value: string): string {
	return Buffer.from(value, "base64").toString("utf8");
}
