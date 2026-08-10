import { ZodError } from "zod";
import {
	type AccessConfig,
	type AccessEnvironment,
	type AccessIdentity,
	accessConfigFromEnvironment,
	authenticateAccessRequest,
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
import { eventValidationIssues } from "./event-validation-issues";

export type AdminEnvironment = AccessEnvironment & GitHubEnvironment;

type HandlerDependencies = {
	authenticate?: (
		request: Request,
		config: AccessConfig,
	) => Promise<AccessIdentity | null>;
	githubFetch?: GitHubFetch;
	deployFetch?: typeof fetch;
	publish?: typeof publishEventDraft;
};

export async function handlePublishEventRequest(
	request: Request,
	environment: AdminEnvironment,
	dependencies: HandlerDependencies = {},
): Promise<Response> {
	let accessConfig: AccessConfig | null;
	try {
		accessConfig = await accessConfigFromEnvironment(environment);
	} catch {
		return jsonError(
			messages.api.adminConfigUnavailable,
			503,
			"admin_config_unavailable",
		);
	}
	if (!accessConfig) {
		return jsonError(
			messages.api.adminNotConfigured,
			503,
			"admin_not_configured",
		);
	}

	const authenticate = dependencies.authenticate ?? authenticateAccessRequest;
	const identity = await authenticate(request, accessConfig);
	if (!identity)
		return jsonError(messages.api.unauthorized, 401, "unauthorized");

	const mediaType = request.headers
		.get("Content-Type")
		?.split(";", 1)[0]
		?.trim()
		.toLowerCase();
	if (mediaType !== "application/json") {
		return jsonError(
			messages.api.unsupportedMedia,
			415,
			"unsupported_media_type",
		);
	}

	let githubConfig: Awaited<ReturnType<typeof githubAppConfigFromEnvironment>>;
	let publishMode: Awaited<ReturnType<typeof githubPublishModeFromEnvironment>>;
	try {
		[githubConfig, publishMode] = await Promise.all([
			githubAppConfigFromEnvironment(environment),
			githubPublishModeFromEnvironment(environment),
		]);
	} catch {
		return jsonError(
			messages.api.publishConfigUnavailable,
			503,
			"publish_config_unavailable",
		);
	}
	if (!publishMode || (publishMode === "live" && !githubConfig)) {
		return jsonError(
			messages.api.publishNotConfigured,
			503,
			"publish_not_configured",
		);
	}

	try {
		const publish = dependencies.publish ?? publishEventDraft;
		const result = await publish({
			draft: await request.json(),
			editor: identity.email,
			config: publishMode === "live" ? githubConfig : null,
			githubFetch: dependencies.githubFetch,
			deployFetch: dependencies.deployFetch,
		});
		return Response.json(result, {
			status: publishResponseStatus(result),
			headers: { "Cache-Control": "no-store" },
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
	if (result.status === "committed-trigger-failed") return 202;
	return result.change === "unchanged" ? 200 : 201;
}

function jsonError(
	error: string,
	status: number,
	code: string,
	extra: Record<string, unknown> = {},
): Response {
	return Response.json(
		{ code, error, ...extra },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
