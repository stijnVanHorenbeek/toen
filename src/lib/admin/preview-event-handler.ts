import { ZodError } from "zod";
import type {
	AccessConfig,
	AccessEnvironment,
	AccessIdentity,
} from "../access/authenticate-access";
import { createEventDraftPreview } from "../content/event-draft";
import { messages } from "../i18n/messages.nl-BE";
import {
	adminJsonResponse,
	readAuthorizedAdminJson,
} from "./admin-api-request";
import { eventValidationIssues } from "./event-validation-issues";

type Dependencies = {
	authenticate?: (
		request: Request,
		config: AccessConfig,
	) => Promise<AccessIdentity | null>;
	maximumBytes?: number;
};

export async function handlePreviewEventRequest(
	request: Request,
	environment: AccessEnvironment,
	dependencies: Dependencies = {},
): Promise<Response> {
	const authorized = await readAuthorizedAdminJson(request, environment, {
		authenticate: dependencies.authenticate,
		maximumBytes: dependencies.maximumBytes,
	});
	if (!authorized.ok) return authorized.response;
	try {
		return adminJsonResponse(createEventDraftPreview(authorized.value));
	} catch (error) {
		if (error instanceof ZodError) {
			return adminJsonResponse(
				{
					code: "invalid_event",
					error: messages.errors.invalidEvent,
					issues: eventValidationIssues(error),
				},
				{ status: 400 },
			);
		}
		console.error(
			JSON.stringify({
				event: "admin_event_preview_failed",
				error: error instanceof Error ? error.name : "UnknownError",
			}),
		);
		return adminJsonResponse(
			{ code: "preview_failed", error: messages.errors.previewFailed },
			{ status: 500 },
		);
	}
}
