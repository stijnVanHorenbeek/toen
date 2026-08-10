import type { ZodType } from "zod";

export type GitHubFetch = (
	input: string | URL,
	init?: RequestInit,
) => Promise<Response>;

export class GitHubRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "GitHubRequestError";
	}
}

type GitHubRequestOptions<Output> = {
	body?: unknown;
	fetch: GitHubFetch;
	method: "GET" | "POST" | "PUT";
	schema: ZodType<Output>;
	token: string;
	url: string;
};

export async function requestGitHub<Output>({
	body,
	fetch,
	method,
	schema,
	token,
	url,
}: GitHubRequestOptions<Output>): Promise<Output> {
	const response = await fetch(url, {
		method,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"User-Agent": "toen-cloudflare-worker",
			"X-GitHub-Api-Version": "2022-11-28",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

	if (!response.ok) {
		throw new GitHubRequestError(
			`GitHub ${method} ${url} failed with ${response.status}`,
			response.status,
		);
	}
	return schema.parse(await response.json());
}
