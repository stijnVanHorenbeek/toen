import { describe, expect, it, vi } from "vitest";
import { routePublicRequest } from "../src/workers/public-router";

describe("static public router", () => {
	it("sends admin APIs only through private service binding", async () => {
		const adminFetch = vi
			.fn()
			.mockResolvedValue(new Response("admin", { status: 200 }));
		const assetFetch = vi
			.fn()
			.mockResolvedValue(new Response("asset", { status: 200 }));
		const environment = {
			ADMIN_API: { fetch: adminFetch } as unknown as Fetcher,
			ASSETS: { fetch: assetFetch } as unknown as Fetcher,
		};
		await expect(
			routePublicRequest(
				new Request("https://example.com/api/admin/events/preview", {
					method: "POST",
				}),
				environment,
			),
		).resolves.toMatchObject({ status: 200 });
		expect(adminFetch).toHaveBeenCalledOnce();
		expect(assetFetch).not.toHaveBeenCalled();

		await routePublicRequest(
			new Request("https://example.com/admin"),
			environment,
		);
		expect(assetFetch).toHaveBeenCalledOnce();
	});
});
