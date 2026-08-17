import { z } from "zod";
import type {
	AccessConfig,
	AccessEnvironment,
	AccessIdentity,
} from "../access/authenticate-access";
import { messages } from "../i18n/messages.nl-BE";
import {
	CloudflareBuildsClient,
	mapReleaseBuildState,
} from "../release/cloudflare-builds";
import {
	exactReleaseBuildConfigFromEnvironment,
	type ReleaseBuildEnvironment,
	releasePipelineModeFromEnvironment,
} from "../release/release-build-config";
import {
	adminJsonResponse,
	readAuthorizedAdminJson,
} from "./admin-api-request";

const inputSchema = z.strictObject({ buildUuid: z.uuid() });

type Dependencies = {
	authenticate?: (
		request: Request,
		config: AccessConfig,
	) => Promise<AccessIdentity | null>;
	buildFetch?: typeof fetch;
};

export async function handleReleaseStatusRequest(
	request: Request,
	environment: AccessEnvironment & ReleaseBuildEnvironment,
	dependencies: Dependencies = {},
): Promise<Response> {
	const authorized = await readAuthorizedAdminJson(request, environment, {
		authenticate: dependencies.authenticate,
	});
	if (!authorized.ok) return authorized.response;
	const input = inputSchema.safeParse(authorized.value);
	if (!input.success) {
		return adminJsonResponse(
			{ code: "invalid_release_status", error: messages.errors.invalidJson },
			{ status: 400 },
		);
	}
	let mode: Awaited<ReturnType<typeof releasePipelineModeFromEnvironment>>;
	let config: Awaited<
		ReturnType<typeof exactReleaseBuildConfigFromEnvironment>
	>;
	try {
		[mode, config] = await Promise.all([
			releasePipelineModeFromEnvironment(environment),
			exactReleaseBuildConfigFromEnvironment(environment),
		]);
	} catch {
		return unavailable(503, "release_status_unavailable");
	}
	if (mode !== "exact" || !config) {
		return unavailable(503, "release_status_unavailable");
	}
	try {
		const builds = await new CloudflareBuildsClient(
			config,
			dependencies.buildFetch,
		).list();
		return adminJsonResponse({
			status: mapReleaseBuildState(input.data.buildUuid, builds, config),
			buildUuid: input.data.buildUuid,
			applicationSha: config.applicationSha,
		});
	} catch {
		return unavailable(502, "release_status_failed");
	}
}

function unavailable(status: number, code: string) {
	return adminJsonResponse(
		{ code, error: messages.api.releaseStatusUnavailable },
		{ status },
	);
}
