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
		return jsonError("Adminconfiguratie is niet beschikbaar.", 503);
	}
	if (!accessConfig) return jsonError("Admin is niet geconfigureerd.", 503);

	const authenticate = dependencies.authenticate ?? authenticateAccessRequest;
	const identity = await authenticate(request, accessConfig);
	if (!identity) return jsonError("Niet geautoriseerd.", 401);

	const mediaType = request.headers
		.get("Content-Type")
		?.split(";", 1)[0]
		?.trim()
		.toLowerCase();
	if (mediaType !== "application/json") {
		return jsonError("Content-Type moet application/json zijn.", 415);
	}

	let githubConfig: Awaited<ReturnType<typeof githubAppConfigFromEnvironment>>;
	let publishMode: Awaited<ReturnType<typeof githubPublishModeFromEnvironment>>;
	try {
		[githubConfig, publishMode] = await Promise.all([
			githubAppConfigFromEnvironment(environment),
			githubPublishModeFromEnvironment(environment),
		]);
	} catch {
		return jsonError("GitHub-configuratie is niet beschikbaar.", 503);
	}
	if (!publishMode || (publishMode === "live" && !githubConfig)) {
		return jsonError("GitHub is niet geconfigureerd.", 503);
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
			return jsonError(
				"Gebeurtenis is ondertussen gewijzigd. Controleer en probeer opnieuw.",
				409,
			);
		}
		if (error instanceof SyntaxError || error instanceof ZodError) {
			return jsonError("Ongeldige gebeurtenis.", 400);
		}
		console.error(
			JSON.stringify({
				event: "admin_event_publish_failed",
				error: error instanceof Error ? error.name : "UnknownError",
			}),
		);
		return jsonError("Publiceren naar GitHub is mislukt.", 502);
	}
}

function publishResponseStatus(
	result: Awaited<ReturnType<typeof publishEventDraft>>,
): number {
	if (result.status === "dry-run") return 200;
	if (result.status === "committed-trigger-failed") return 202;
	return result.change === "unchanged" ? 200 : 201;
}

function jsonError(error: string, status: number): Response {
	return Response.json(
		{ error },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
