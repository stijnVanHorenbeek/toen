import { ZodError } from "zod";
import type {
	AccessConfig,
	AccessEnvironment,
	AccessIdentity,
} from "../access/authenticate-access";
import {
	ContentConflictError,
	type GitHubFetch,
	publishEventDraft,
} from "../github/event-publisher";
import {
	type GitHubEnvironment,
	githubAppConfigFromEnvironment,
	githubPublishModeFromEnvironment,
} from "../github/github-config";
import { messages } from "../i18n/messages.nl-BE";
import {
	exactReleaseBuildConfigFromEnvironment,
	type ReleaseBuildEnvironment,
	releasePipelineModeFromEnvironment,
} from "../release/release-build-config";
import {
	adminJsonResponse,
	readAuthorizedAdminJson,
} from "./admin-api-request";
import { eventValidationIssues } from "./event-validation-issues";

export type AdminEnvironment = AccessEnvironment &
	GitHubEnvironment &
	ReleaseBuildEnvironment;

type HandlerDependencies = {
	authenticate?: (
		request: Request,
		config: AccessConfig,
	) => Promise<AccessIdentity | null>;
	githubFetch?: GitHubFetch;
	deployFetch?: typeof fetch;
	buildFetch?: typeof fetch;
	publish?: typeof publishEventDraft;
	maximumBytes?: number;
};

export async function handlePublishEventRequest(
	request: Request,
	environment: AdminEnvironment,
	dependencies: HandlerDependencies = {},
): Promise<Response> {
	const authorized = await readAuthorizedAdminJson(request, environment, {
		authenticate: dependencies.authenticate,
		maximumBytes: dependencies.maximumBytes,
	});
	if (!authorized.ok) return authorized.response;

	let githubConfig: Awaited<ReturnType<typeof githubAppConfigFromEnvironment>>;
	let publishMode: Awaited<ReturnType<typeof githubPublishModeFromEnvironment>>;
	let pipelineMode: Awaited<
		ReturnType<typeof releasePipelineModeFromEnvironment>
	>;
	let releaseConfig: Awaited<
		ReturnType<typeof exactReleaseBuildConfigFromEnvironment>
	>;
	try {
		[githubConfig, publishMode, pipelineMode, releaseConfig] =
			await Promise.all([
				githubAppConfigFromEnvironment(environment),
				githubPublishModeFromEnvironment(environment),
				releasePipelineModeFromEnvironment(environment),
				exactReleaseBuildConfigFromEnvironment(environment),
			]);
	} catch {
		return jsonError(
			messages.api.publishConfigUnavailable,
			503,
			"publish_config_unavailable",
		);
	}
	if (
		!publishMode ||
		!pipelineMode ||
		(publishMode === "live" &&
			(!githubConfig ||
				(pipelineMode === "legacy" && !githubConfig.deployHookUrl) ||
				(pipelineMode === "exact" && !releaseConfig)))
	) {
		return jsonError(
			messages.api.publishNotConfigured,
			503,
			"publish_not_configured",
		);
	}

	try {
		const publish = dependencies.publish ?? publishEventDraft;
		const result = await publish({
			draft: authorized.value,
			editor: authorized.identity.email,
			config: publishMode === "live" ? githubConfig : null,
			githubFetch: dependencies.githubFetch,
			deployFetch: dependencies.deployFetch,
			buildFetch: dependencies.buildFetch,
			pipelineMode,
			releaseConfig,
		});
		return adminJsonResponse(result, {
			status: publishResponseStatus(result),
		});
	} catch (error) {
		if (error instanceof ContentConflictError) {
			return jsonError(messages.api.conflict, 409, "content_conflict");
		}
		if (error instanceof ZodError) {
			return jsonError(messages.errors.invalidEvent, 400, "invalid_event", {
				issues: eventValidationIssues(error),
			});
		}
		if (error instanceof SyntaxError) {
			return jsonError(messages.errors.invalidJson, 400, "invalid_json");
		}
		console.error(
			JSON.stringify({
				event: "admin_event_publish_failed",
				error: error instanceof Error ? error.name : "UnknownError",
			}),
		);
		return jsonError(messages.errors.publishFailed, 502, "publish_failed");
	}
}

function publishResponseStatus(
	result: Awaited<ReturnType<typeof publishEventDraft>>,
): number {
	if (result.status === "dry-run") return 200;
	if (
		result.status === "committed-trigger-failed" ||
		result.status === "committed" ||
		result.status === "building"
	) {
		return 202;
	}
	return result.change === "unchanged" ? 200 : 201;
}

function jsonError(
	error: string,
	status: number,
	code: string,
	extra: Record<string, unknown> = {},
): Response {
	return adminJsonResponse({ code, error, ...extra }, { status });
}
