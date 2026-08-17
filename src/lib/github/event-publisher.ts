import {
	createEventDraftPreview,
	parseEventDraft,
} from "../content/event-draft";
import {
	CloudflareBuildsClient,
	type ExactReleaseBuildConfig,
} from "../release/cloudflare-builds";
import { coordinateLockedExactRelease } from "../release/release-coordinator";
import {
	createInstallationToken,
	type GitHubAppCredentials,
} from "./github-app";
import {
	GitHubRepository,
	type GitHubRepositoryConfig,
} from "./github-repository";
import type { GitHubFetch } from "./github-request";

export { ContentConflictError } from "./github-repository";
export type { GitHubFetch } from "./github-request";

export type GitHubAppConfig = GitHubAppCredentials &
	GitHubRepositoryConfig & {
		deployHookUrl?: string;
	};

type PublishEventDraftOptions = {
	draft: unknown;
	editor: string;
	config: GitHubAppConfig | null;
	githubFetch?: GitHubFetch;
	deployFetch?: typeof fetch;
	buildFetch?: typeof fetch;
	pipelineMode?: "legacy" | "exact";
	releaseConfig?: ExactReleaseBuildConfig | null;
	releaseCoordinator?: typeof coordinateLockedExactRelease;
};

export async function publishEventDraft({
	buildFetch = fetch,
	config,
	deployFetch = fetch,
	draft,
	editor,
	githubFetch = fetch,
	pipelineMode = "legacy",
	releaseConfig = null,
	releaseCoordinator = coordinateLockedExactRelease,
}: PublishEventDraftOptions) {
	const event = parseEventDraft(draft);
	const preview = createEventDraftPreview(event);
	if (!config) {
		return { status: "dry-run" as const, ...preview };
	}

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
	const published = await repository.upsertFile({
		content: preview.markdown,
		message: `feat(content): publish ${event.slug}\n\nEditor: ${editor}`,
		path: preview.path,
	});
	const result = {
		...preview,
		...published,
		commitUrl: `https://github.com/${config.owner}/${config.repository}/commit/${published.commitSha}`,
	};

	if (pipelineMode === "exact") {
		if (!releaseConfig) {
			return {
				status: "committed" as const,
				reason: "release-config-unavailable" as const,
				...result,
			};
		}
		const builds = new CloudflareBuildsClient(releaseConfig, buildFetch);
		const release = await releaseCoordinator({
			appSha: releaseConfig.applicationSha,
			builds,
			contentSha: published.commitSha,
			repository,
		});
		return { ...result, ...release };
	}

	if (!config.deployHookUrl) {
		return { status: "committed-trigger-failed" as const, ...result };
	}
	try {
		const response = await deployFetch(config.deployHookUrl, {
			method: "POST",
		});
		if (!response.ok)
			throw new Error(`Deploy hook failed with ${response.status}`);
		return { status: "committed-and-triggered" as const, ...result };
	} catch {
		return { status: "committed-trigger-failed" as const, ...result };
	}
}
