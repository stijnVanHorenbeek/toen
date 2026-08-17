import { z } from "zod";

const buildUuidSchema = z.uuid();
const triggerResponseSchema = z.strictObject({
	success: z.literal(true),
	errors: z.array(z.unknown()),
	messages: z.array(z.unknown()),
	result: z.strictObject({
		build_uuid: buildUuidSchema,
		created_on: z.string(),
	}),
});
const buildSchema = z.object({
	build_uuid: buildUuidSchema,
	created_on: z.string(),
	status: z.enum(["queued", "initializing", "running", "stopped"]),
	build_outcome: z
		.enum(["success", "fail", "skipped", "cancelled", "terminated"])
		.nullish(),
	trigger: z.object({ trigger_uuid: z.uuid() }),
	build_trigger_metadata: z.object({ commit_hash: z.string() }),
});
const listResponseSchema = z.object({
	success: z.literal(true),
	result: z.array(buildSchema),
});

export type ExactReleaseBuildConfig = {
	accountId: string;
	apiToken: string;
	applicationSha: string;
	triggerUuid: string;
	workerTag: string;
};

export type ReleaseBuildState =
	| "committed"
	| "building"
	| "activated"
	| "failed"
	| "superseded";

export type ReleaseBuild = {
	buildUuid: string;
	createdOn: string;
	status: "queued" | "initializing" | "running" | "stopped";
	buildOutcome:
		| "success"
		| "fail"
		| "skipped"
		| "cancelled"
		| "terminated"
		| null;
	triggerUuid: string;
	commitHash: string;
};

type BuildsFetch = (
	input: string | URL,
	init?: RequestInit,
) => Promise<Response>;

export class CloudflareBuildsClient {
	readonly #config: ExactReleaseBuildConfig;
	readonly #fetch: BuildsFetch;

	constructor(
		config: ExactReleaseBuildConfig,
		fetch: BuildsFetch = globalThis.fetch,
	) {
		this.#config = config;
		this.#fetch = fetch;
	}

	async trigger(): Promise<{ buildUuid: string }> {
		const response = await this.#request(
			`/builds/triggers/${this.#config.triggerUuid}/builds`,
			{
				method: "POST",
				body: JSON.stringify({ commit_hash: this.#config.applicationSha }),
			},
		);
		const parsed = triggerResponseSchema.parse(await response.json());
		return { buildUuid: parsed.result.build_uuid };
	}

	async list(): Promise<ReleaseBuild[]> {
		const response = await this.#request(
			`/builds/workers/${this.#config.workerTag}/builds?per_page=200`,
			{ method: "GET" },
		);
		const parsed = listResponseSchema.parse(await response.json());
		return parsed.result.map((build) => ({
			buildUuid: build.build_uuid,
			createdOn: build.created_on,
			status: build.status,
			buildOutcome: build.build_outcome ?? null,
			triggerUuid: build.trigger.trigger_uuid,
			commitHash: build.build_trigger_metadata.commit_hash,
		}));
	}

	async #request(pathname: string, init: RequestInit) {
		const response = await this.#fetch(
			`https://api.cloudflare.com/client/v4/accounts/${this.#config.accountId}${pathname}`,
			{
				...init,
				headers: {
					Authorization: `Bearer ${this.#config.apiToken}`,
					"Content-Type": "application/json",
				},
			},
		);
		if (!response.ok) {
			throw new Error(`Cloudflare Builds API failed with ${response.status}`);
		}
		return response;
	}
}

export function mapReleaseBuildState(
	buildUuid: string,
	builds: ReleaseBuild[],
	config: ExactReleaseBuildConfig,
): ReleaseBuildState {
	const current = builds.find((build) => build.buildUuid === buildUuid);
	if (!current) return "building";
	if (
		current.triggerUuid !== config.triggerUuid ||
		current.commitHash !== config.applicationSha
	) {
		return "failed";
	}
	if (current.status === "stopped") {
		if (current.buildOutcome !== "success") return "failed";
		const newer = builds.some(
			(build) =>
				isSameReleaseTrigger(build, config) &&
				Date.parse(build.createdOn) > Date.parse(current.createdOn),
		);
		return newer ? "superseded" : "activated";
	}
	const newer = builds.some(
		(build) =>
			isSameReleaseTrigger(build, config) &&
			Date.parse(build.createdOn) > Date.parse(current.createdOn),
	);
	return newer ? "superseded" : "building";
}

export function isLatestReleaseBuild(
	buildUuid: string,
	builds: ReleaseBuild[],
	config: ExactReleaseBuildConfig,
): boolean {
	const current = builds.find((build) => build.buildUuid === buildUuid);
	if (
		!current ||
		!isSameReleaseTrigger(current, config) ||
		current.commitHash !== config.applicationSha
	) {
		return false;
	}
	return !builds.some(
		(build) =>
			isSameReleaseTrigger(build, config) &&
			Date.parse(build.createdOn) > Date.parse(current.createdOn),
	);
}

function isSameReleaseTrigger(
	build: ReleaseBuild,
	config: ExactReleaseBuildConfig,
) {
	return build.triggerUuid === config.triggerUuid;
}
