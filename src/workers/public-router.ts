type PublicRouterEnvironment = {
	ADMIN_API: Fetcher;
	ASSETS: Fetcher;
};

export function routePublicRequest(
	request: Request,
	environment: PublicRouterEnvironment,
): Promise<Response> {
	const pathname = new URL(request.url).pathname;
	if (pathname.startsWith("/api/admin/")) {
		return environment.ADMIN_API.fetch(request);
	}
	return environment.ASSETS.fetch(request);
}

export default {
	fetch(request: Request, environment: PublicRouterEnvironment) {
		return routePublicRequest(request, environment);
	},
} satisfies ExportedHandler<PublicRouterEnvironment>;
