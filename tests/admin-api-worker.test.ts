import { describe, expect, it, vi } from "vitest";
import { routeAdminApiRequest } from "../src/workers/admin-api";

const environment = {};

describe("native admin API Worker", () => {
	it("routes exact preview and publish POST paths", async () => {
		const preview = vi
			.fn()
			.mockResolvedValue(Response.json({ route: "preview" }));
		const publish = vi
			.fn()
			.mockResolvedValue(Response.json({ route: "publish" }));
		const previewResponse = await routeAdminApiRequest(
			new Request("https://example.com/api/admin/events/preview", {
				method: "POST",
			}),
			environment,
			{ preview, publish },
		);
		expect(previewResponse.status).toBe(200);
		expect(preview).toHaveBeenCalledOnce();
		expect(publish).not.toHaveBeenCalled();
		const publishResponse = await routeAdminApiRequest(
			new Request("https://example.com/api/admin/events/publish", {
				method: "POST",
			}),
			environment,
			{ preview, publish },
		);
		expect(publishResponse.status).toBe(200);
		expect(publish).toHaveBeenCalledOnce();
	});

	it("rejects other methods and unknown paths with no-store", async () => {
		const methodCancel = vi.fn();
		const method = await routeAdminApiRequest(
			streamingRequest(
				"https://example.com/api/admin/events/preview",
				"PUT",
				methodCancel,
			),
			environment,
		);
		expect(method.status).toBe(405);
		expect(method.headers.get("Allow")).toBe("POST");
		expect(method.headers.get("Cache-Control")).toBe("no-store");
		expect(methodCancel).toHaveBeenCalledOnce();
		const missingCancel = vi.fn();
		const missing = await routeAdminApiRequest(
			streamingRequest(
				"https://example.com/api/admin/events/unknown",
				"POST",
				missingCancel,
			),
			environment,
		);
		expect(missing.status).toBe(404);
		expect(missing.headers.get("Cache-Control")).toBe("no-store");
		expect(missingCancel).toHaveBeenCalledOnce();
	});
});

function streamingRequest(url: string, method: string, cancel: () => void) {
	return new Request(url, {
		method,
		body: new ReadableStream<Uint8Array>({ cancel }),
		duplex: "half",
	} as RequestInit & { duplex: "half" });
}
