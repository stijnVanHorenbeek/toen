import { z } from "zod";
import {
	type SecretsStoreBinding,
	storedValue,
} from "../environment/stored-value";
import type { ExactReleaseBuildConfig } from "./cloudflare-builds";

const modeSchema = z.enum(["legacy", "exact"]);
const exactConfigSchema = z.strictObject({
	apiToken: z.string().min(16),
	accountId: z.string().regex(/^[0-9a-f]{32}$/),
	triggerUuid: z.uuid(),
	workerTag: z.string().regex(/^[0-9a-f]{32}$/),
	applicationSha: z.string().regex(/^[0-9a-f]{40}$/),
});

export type ReleaseBuildEnvironment = {
	RELEASE_PIPELINE_MODE?: z.input<typeof modeSchema>;
	RELEASE_PIPELINE_MODE_STORE?: SecretsStoreBinding;
	CLOUDFLARE_BUILDS_API_TOKEN?: string;
	CLOUDFLARE_BUILDS_API_TOKEN_STORE?: SecretsStoreBinding;
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_ACCOUNT_ID_STORE?: SecretsStoreBinding;
	CLOUDFLARE_BUILD_TRIGGER_UUID?: string;
	CLOUDFLARE_BUILD_TRIGGER_UUID_STORE?: SecretsStoreBinding;
	CLOUDFLARE_WORKER_TAG?: string;
	CLOUDFLARE_WORKER_TAG_STORE?: SecretsStoreBinding;
	RELEASE_APPLICATION_SHA?: string;
	RELEASE_APPLICATION_SHA_STORE?: SecretsStoreBinding;
};

export async function releasePipelineModeFromEnvironment(
	environment: ReleaseBuildEnvironment,
): Promise<z.output<typeof modeSchema> | null> {
	const value = await storedValue(
		environment.RELEASE_PIPELINE_MODE,
		environment.RELEASE_PIPELINE_MODE_STORE,
	);
	const parsed = modeSchema.safeParse(value ?? "legacy");
	return parsed.success ? parsed.data : null;
}

export async function exactReleaseBuildConfigFromEnvironment(
	environment: ReleaseBuildEnvironment,
): Promise<ExactReleaseBuildConfig | null> {
	const [apiToken, accountId, triggerUuid, workerTag, applicationSha] =
		await Promise.all([
			storedValue(
				environment.CLOUDFLARE_BUILDS_API_TOKEN,
				environment.CLOUDFLARE_BUILDS_API_TOKEN_STORE,
			),
			storedValue(
				environment.CLOUDFLARE_ACCOUNT_ID,
				environment.CLOUDFLARE_ACCOUNT_ID_STORE,
			),
			storedValue(
				environment.CLOUDFLARE_BUILD_TRIGGER_UUID,
				environment.CLOUDFLARE_BUILD_TRIGGER_UUID_STORE,
			),
			storedValue(
				environment.CLOUDFLARE_WORKER_TAG,
				environment.CLOUDFLARE_WORKER_TAG_STORE,
			),
			storedValue(
				environment.RELEASE_APPLICATION_SHA,
				environment.RELEASE_APPLICATION_SHA_STORE,
			),
		]);
	const parsed = exactConfigSchema.safeParse({
		apiToken,
		accountId,
		triggerUuid,
		workerTag,
		applicationSha,
	});
	return parsed.success ? parsed.data : null;
}
