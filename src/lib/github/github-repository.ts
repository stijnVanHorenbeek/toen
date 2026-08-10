import { z } from "zod";
import {
	type GitHubFetch,
	GitHubRequestError,
	requestGitHub,
} from "./github-request";

const gitReferenceSchema = z.object({
	object: z.object({ sha: z.string().min(1) }),
});
const createdReferenceSchema = z.object({ ref: z.string().min(1) });
const contentCommitSchema = z.object({
	commit: z.object({ sha: z.string().min(1) }),
});
const contentFileSchema = z.object({
	content: z.string(),
	encoding: z.literal("base64"),
	sha: z.string().min(1),
});
const pullRequestSchema = z.object({
	number: z.number().int().positive(),
	html_url: z.url(),
});
const pullRequestsSchema = z.array(pullRequestSchema);

export type GitHubRepositoryConfig = {
	owner: string;
	repository: string;
	baseBranch: string;
};

export class GitHubRepository {
	readonly #config: GitHubRepositoryConfig;
	readonly #fetch: GitHubFetch;
	readonly #token: string;

	constructor({
		config,
		fetch,
		token,
	}: {
		config: GitHubRepositoryConfig;
		fetch: GitHubFetch;
		token: string;
	}) {
		this.#config = config;
		this.#fetch = fetch;
		this.#token = token;
	}

	async findOpenPullRequest(
		branch: string,
	): Promise<{ number: number; url: string } | null> {
		const query = new URLSearchParams({
			state: "open",
			head: `${this.#config.owner}:${branch}`,
			base: this.#config.baseBranch,
		});
		const pullRequests = await this.#request({
			method: "GET",
			path: `/pulls?${query}`,
			schema: pullRequestsSchema,
		});
		const pullRequest = pullRequests[0];
		return pullRequest
			? { number: pullRequest.number, url: pullRequest.html_url }
			: null;
	}

	async ensureBranch(branch: string): Promise<void> {
		try {
			await this.#request({
				method: "GET",
				path: `/git/ref/heads/${branch}`,
				schema: gitReferenceSchema,
			});
			return;
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}

		const base = await this.#request({
			method: "GET",
			path: `/git/ref/heads/${this.#config.baseBranch}`,
			schema: gitReferenceSchema,
		});
		await this.#request({
			method: "POST",
			path: "/git/refs",
			body: { ref: `refs/heads/${branch}`, sha: base.object.sha },
			schema: createdReferenceSchema,
		});
	}

	async ensureFile({
		branch,
		content,
		message,
		path,
	}: {
		branch: string;
		content: string;
		message: string;
		path: string;
	}): Promise<void> {
		const query = new URLSearchParams({ ref: branch });
		try {
			const existing = await this.#request({
				method: "GET",
				path: `/contents/${path}?${query}`,
				schema: contentFileSchema,
			});
			if (decodeBase64(existing.content) !== content) {
				throw new Error(`Existing branch content differs at ${path}`);
			}
			return;
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}

		await this.createFile({ branch, content, message, path });
	}

	async createFile({
		branch,
		content,
		message,
		path,
	}: {
		branch: string;
		content: string;
		message: string;
		path: string;
	}): Promise<void> {
		await this.#request({
			method: "PUT",
			path: `/contents/${path}`,
			body: { branch, content: encodeBase64(content), message },
			schema: contentCommitSchema,
		});
	}

	async createPullRequest({
		body,
		branch,
		title,
	}: {
		body: string;
		branch: string;
		title: string;
	}): Promise<{ number: number; url: string }> {
		const pullRequest = await this.#request({
			method: "POST",
			path: "/pulls",
			body: {
				base: this.#config.baseBranch,
				body,
				head: branch,
				title,
			},
			schema: pullRequestSchema,
		});
		return { number: pullRequest.number, url: pullRequest.html_url };
	}

	async #request<Output>({
		body,
		method,
		path,
		schema,
	}: {
		body?: unknown;
		method: "GET" | "POST" | "PUT";
		path: string;
		schema: z.ZodType<Output>;
	}): Promise<Output> {
		return requestGitHub({
			body,
			fetch: this.#fetch,
			method,
			schema,
			token: this.#token,
			url: `https://api.github.com/repos/${this.#config.owner}/${this.#config.repository}${path}`,
		});
	}
}

function encodeBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function decodeBase64(value: string): string {
	const binary = atob(value.replace(/\s/g, ""));
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function isNotFound(error: unknown): boolean {
	return error instanceof GitHubRequestError && error.status === 404;
}
