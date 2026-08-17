import { z } from "zod";
import {
	type GitHubFetch,
	GitHubRequestError,
	requestGitHub,
} from "./github-request";

const gitReferenceSchema = z.object({
	object: z.object({ sha: z.string().min(1) }),
});
const contentCommitSchema = z.object({
	commit: z.object({ sha: z.string().min(1) }),
});
const contentFileSchema = z.object({
	content: z.string(),
	encoding: z.literal("base64"),
	sha: z.string().min(1),
});

type ContentFile = z.infer<typeof contentFileSchema>;

export type GitHubRepositoryConfig = {
	owner: string;
	repository: string;
	baseBranch: string;
};

export type FileChange = "created" | "unchanged";

export class ContentConflictError extends Error {
	constructor(readonly path: string) {
		super(`Content changed concurrently at ${path}`);
		this.name = "ContentConflictError";
	}
}

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

	async readTextFile(path: string): Promise<{
		commitSha: string;
		blobSha: string;
		content: string;
	} | null> {
		const snapshot = await this.#snapshotFile(path);
		return snapshot.file
			? {
					commitSha: snapshot.commitSha,
					blobSha: snapshot.file.sha,
					content: decodeBase64(snapshot.file.content),
				}
			: null;
	}

	async replaceFile({
		content,
		expectedBlobSha,
		message,
		path,
	}: {
		content: string;
		expectedBlobSha: string;
		message: string;
		path: string;
	}): Promise<{ commitSha: string }> {
		try {
			const commit = await this.#request({
				method: "PUT",
				path: `/contents/${path}`,
				body: {
					branch: this.#config.baseBranch,
					content: encodeBase64(content),
					message,
					sha: expectedBlobSha,
				},
				schema: contentCommitSchema,
			});
			return { commitSha: commit.commit.sha };
		} catch (error) {
			if (isWriteConflict(error)) throw new ContentConflictError(path);
			throw error;
		}
	}

	async upsertFile({
		content,
		message,
		path,
	}: {
		content: string;
		message: string;
		path: string;
	}): Promise<{ change: FileChange; commitSha: string }> {
		const existing = await this.#snapshotFile(path);
		if (existing.file) {
			if (decodeBase64(existing.file.content) !== content) {
				throw new ContentConflictError(path);
			}
			return { change: "unchanged", commitSha: existing.commitSha };
		}

		try {
			const commit = await this.#request({
				method: "PUT",
				path: `/contents/${path}`,
				body: {
					branch: this.#config.baseBranch,
					content: encodeBase64(content),
					message,
				},
				schema: contentCommitSchema,
			});
			return { change: "created", commitSha: commit.commit.sha };
		} catch (error) {
			if (!isWriteConflict(error)) throw error;
		}

		const reconciled = await this.#snapshotFile(path);
		if (reconciled.file && decodeBase64(reconciled.file.content) === content) {
			return { change: "unchanged", commitSha: reconciled.commitSha };
		}
		throw new ContentConflictError(path);
	}

	async #snapshotFile(
		path: string,
	): Promise<{ commitSha: string; file: ContentFile | null }> {
		const commitSha = await this.#headSha();
		return { commitSha, file: await this.#findFile(path, commitSha) };
	}

	async #findFile(path: string, ref: string): Promise<ContentFile | null> {
		const query = new URLSearchParams({ ref });
		try {
			return await this.#request({
				method: "GET",
				path: `/contents/${path}?${query}`,
				schema: contentFileSchema,
			});
		} catch (error) {
			if (isNotFound(error)) return null;
			throw error;
		}
	}

	async #headSha(): Promise<string> {
		const reference = await this.#request({
			method: "GET",
			path: `/git/ref/heads/${this.#config.baseBranch}`,
			schema: gitReferenceSchema,
		});
		return reference.object.sha;
	}

	async #request<Output>({
		body,
		method,
		path,
		schema,
	}: {
		body?: unknown;
		method: "GET" | "PUT";
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

function isWriteConflict(error: unknown): boolean {
	return (
		error instanceof GitHubRequestError &&
		(error.status === 409 || error.status === 422)
	);
}
