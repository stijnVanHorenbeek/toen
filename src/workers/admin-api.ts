import {
	adminJsonResponse,
	cancelUnreadRequestBody,
} from "../lib/admin/admin-api-request";
import { handlePreviewEventRequest } from "../lib/admin/preview-event-handler";
import {
	type AdminEnvironment,
	handlePublishEventRequest,
} from "../lib/admin/publish-event-handler";

type AdminRouteHandler = (
	request: Request,
	environment: AdminEnvironment,
) => Promise<Response>;

type RouteDependencies = {
	preview?: AdminRouteHandler;
	publish?: AdminRouteHandler;
};

export async function routeAdminApiRequest(
	request: Request,
	environment: AdminEnvironment,
	dependencies: RouteDependencies = {},
): Promise<Response> {
	const pathname = new URL(request.url).pathname;
	const handler =
		pathname === "/api/admin/events/preview"
			? (dependencies.preview ?? handlePreviewEventRequest)
			: pathname === "/api/admin/events/publish"
				? (dependencies.publish ?? handlePublishEventRequest)
				: null;
	if (!handler) {
		await cancelUnreadRequestBody(request);
		return adminJsonResponse(
			{ code: "not_found", error: "Not found" },
			{ status: 404 },
		);
	}
	if (request.method !== "POST") {
		await cancelUnreadRequestBody(request);
		return adminJsonResponse(
			{ code: "method_not_allowed", error: "Method not allowed" },
			{ status: 405, headers: { Allow: "POST" } },
		);
	}
	return handler(request, environment);
}

export default {
	fetch(request: Request, environment: AdminEnvironment) {
		return routeAdminApiRequest(request, environment);
	},
} satisfies ExportedHandler<AdminEnvironment>;
