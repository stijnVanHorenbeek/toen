import {
	createEventDraftPreview,
	parseEventDraft,
} from "../content/event-draft";
import {
	createInstallationToken,
	type GitHubAppCredentials,
} from "./github-app";
import {
	GitHubRepository,
	type GitHubRepositoryConfig,
} from "./github-repository";
import type { GitHubFetch } from "./github-request";

export type { GitHubFetch } from "./github-request";

export type GitHubAppConfig = GitHubAppCredentials & GitHubRepositoryConfig;

type PublishEventDraftOptions = {
	draft: unknown;
	editor: string;
	config: GitHubAppConfig | null;
	githubFetch?: GitHubFetch;
	branchSuffix?: string;
};

export async function publishEventDraft({
	branchSuffix,
	config,
	draft,
	editor,
	githubFetch = fetch,
}: PublishEventDraftOptions) {
	const event = parseEventDraft(draft);
	const preview = createEventDraftPreview(event);
	if (!config) {
		return { status: "dry-run" as const, ...preview };
	}

	const suffix = branchSuffix ?? (await contentDigest(preview.markdown));
	const branch = `content/${event.slug}-${suffix}`;
	const token = await createInstallationToken({
		credentials: config,
		fetch: githubFetch,
		repository: config.repository,
	});
	const repository = new GitHubRepository({
		config,
		fetch: githubFetch,
		token,
	});
	const existingPullRequest = await repository.findOpenPullRequest(branch);
	if (existingPullRequest) {
		return {
			status: "created" as const,
			...preview,
			branch,
			pullRequestNumber: existingPullRequest.number,
			pullRequestUrl: existingPullRequest.url,
		};
	}

	await repository.ensureBranch(branch);
	await repository.ensureFile({
		branch,
		content: preview.markdown,
		message: `feat(content): add ${event.slug}`,
		path: preview.path,
	});
	const pullRequest = await repository.createPullRequest({
		branch,
		title: `feat(content): add ${event.title}`,
		body: [
			"Automatisch aangemaakt vanuit Toen.",
			"",
			`Redacteur: ${editor}`,
			`Bestand: \`${preview.path}\``,
		].join("\n"),
	});

	return {
		status: "created" as const,
		...preview,
		branch,
		pullRequestNumber: pullRequest.number,
		pullRequestUrl: pullRequest.url,
	};
}

async function contentDigest(content: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(content),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	)
		.join("")
		.slice(0, 12);
}
