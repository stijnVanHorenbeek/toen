import { z } from "zod";
import {
	type SecretsStoreBinding,
	storedValue,
} from "../environment/stored-value";
import type { GitHubAppConfig } from "./event-publisher";

const publishModeSchema = z.enum(["live", "dry-run"]);
const deployHookPath = "/client/v4/workers/builds/deploy_hooks/";
const deployHookUrlSchema = z.url().refine((value) => {
	const url = new URL(value);
	return (
		url.protocol === "https:" &&
		url.host === "api.cloudflare.com" &&
		!url.username &&
		!url.password &&
		url.pathname.startsWith(deployHookPath) &&
		url.pathname.length > deployHookPath.length &&
		!url.search &&
		!url.hash
	);
});

const environmentSchema = z.object({
	GITHUB_APP_ID: z.string().regex(/^\d+$/),
	GITHUB_APP_INSTALLATION_ID: z.string().regex(/^\d+$/),
	GITHUB_APP_PRIVATE_KEY: z.string().min(1),
	GITHUB_REPOSITORY: z.string().regex(/^[^/]+\/[^/]+$/),
	GITHUB_BASE_BRANCH: z.string().min(1),
	CONTENT_DEPLOY_HOOK_URL: deployHookUrlSchema.optional(),
});

export type GitHubEnvironment = Partial<z.input<typeof environmentSchema>> & {
	GITHUB_PUBLISH_MODE?: z.input<typeof publishModeSchema>;
	GITHUB_PUBLISH_MODE_STORE?: SecretsStoreBinding;
	GITHUB_APP_ID_STORE?: SecretsStoreBinding;
	GITHUB_APP_INSTALLATION_ID_STORE?: SecretsStoreBinding;
	GITHUB_APP_PRIVATE_KEY_STORE?: SecretsStoreBinding;
	GITHUB_REPOSITORY_STORE?: SecretsStoreBinding;
	GITHUB_BASE_BRANCH_STORE?: SecretsStoreBinding;
	CONTENT_DEPLOY_HOOK_URL?: z.input<typeof deployHookUrlSchema>;
	CONTENT_DEPLOY_HOOK_URL_STORE?: SecretsStoreBinding;
};

export async function githubPublishModeFromEnvironment(
	environment: GitHubEnvironment,
): Promise<z.output<typeof publishModeSchema> | null> {
	const value = await storedValue(
		environment.GITHUB_PUBLISH_MODE,
		environment.GITHUB_PUBLISH_MODE_STORE,
	);
	const parsed = publishModeSchema.safeParse(value ?? "dry-run");
	return parsed.success ? parsed.data : null;
}

export async function githubAppConfigFromEnvironment(
	environment: GitHubEnvironment,
): Promise<GitHubAppConfig | null> {
	const [
		appId,
		installationId,
		privateKey,
		repositoryReference,
		baseBranch,
		deployHookUrl,
	] = await Promise.all([
		storedValue(environment.GITHUB_APP_ID, environment.GITHUB_APP_ID_STORE),
		storedValue(
			environment.GITHUB_APP_INSTALLATION_ID,
			environment.GITHUB_APP_INSTALLATION_ID_STORE,
		),
		storedValue(
			environment.GITHUB_APP_PRIVATE_KEY,
			environment.GITHUB_APP_PRIVATE_KEY_STORE,
		),
		storedValue(
			environment.GITHUB_REPOSITORY,
			environment.GITHUB_REPOSITORY_STORE,
		),
		storedValue(
			environment.GITHUB_BASE_BRANCH,
			environment.GITHUB_BASE_BRANCH_STORE,
		),
		storedValue(
			environment.CONTENT_DEPLOY_HOOK_URL,
			environment.CONTENT_DEPLOY_HOOK_URL_STORE,
		),
	]);
	const parsed = environmentSchema.safeParse({
		GITHUB_APP_ID: appId,
		GITHUB_APP_INSTALLATION_ID: installationId,
		GITHUB_APP_PRIVATE_KEY: privateKey,
		GITHUB_REPOSITORY: repositoryReference,
		GITHUB_BASE_BRANCH: baseBranch,
		CONTENT_DEPLOY_HOOK_URL: deployHookUrl,
	});
	if (!parsed.success) return null;

	const [owner, repository] = parsed.data.GITHUB_REPOSITORY.split("/");
	return {
		appId: parsed.data.GITHUB_APP_ID,
		installationId: parsed.data.GITHUB_APP_INSTALLATION_ID,
		privateKey: parsed.data.GITHUB_APP_PRIVATE_KEY,
		owner,
		repository,
		baseBranch: parsed.data.GITHUB_BASE_BRANCH,
		...(parsed.data.CONTENT_DEPLOY_HOOK_URL
			? { deployHookUrl: parsed.data.CONTENT_DEPLOY_HOOK_URL }
			: {}),
	};
}
