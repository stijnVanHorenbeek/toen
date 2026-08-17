import { describe, expect, it, vi } from "vitest";
import { readAuthorizedAdminJson } from "../src/lib/admin/admin-api-request";

const environment = {
	ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
	ACCESS_POLICY_AUD: "application-audience",
};
const authenticate = vi.fn().mockResolvedValue({ email: "editor@example.com" });

describe("authorized admin JSON requests", () => {
	it("authenticates and reads bounded same-origin JSON", async () => {
		const result = await readAuthorizedAdminJson(
			request('{"title":"Test"}'),
			environment,
			{ authenticate },
		);
		expect(result).toMatchObject({
			ok: true,
			identity: { email: "editor@example.com" },
			value: { title: "Test" },
		});
	});

	it("cancels unread service-binding bodies on early rejection", async () => {
		const cancel = vi.fn();
		const body = new ReadableStream<Uint8Array>({ cancel });
		const result = await readAuthorizedAdminJson(
			new Request("https://example.com/api/admin/events/preview", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://example.com",
				},
				body,
				duplex: "half",
			} as RequestInit & { duplex: "half" }),
			{},
		);
		expect(result.ok).toBe(false);
		expect(cancel).toHaveBeenCalledOnce();
	});

	it("rejects cross-origin and non-JSON requests without reading content", async () => {
		const crossOrigin = await readAuthorizedAdminJson(
			request("{}", { Origin: "https://attacker.example" }),
			environment,
			{ authenticate },
		);
		expect(crossOrigin.ok).toBe(false);
		if (!crossOrigin.ok) {
			expect(crossOrigin.response.status).toBe(403);
			await expect(crossOrigin.response.json()).resolves.toMatchObject({
				code: "invalid_origin",
			});
		}
		const unsupported = await readAuthorizedAdminJson(
			request("{}", { "Content-Type": "text/plain" }),
			environment,
			{ authenticate },
		);
		expect(unsupported.ok).toBe(false);
		if (!unsupported.ok) expect(unsupported.response.status).toBe(415);
	});

	it("rejects malformed UTF-8, malformed JSON, and excessive node counts", async () => {
		for (const malformed of ["{", JSON.stringify(Array(10_001).fill(null))]) {
			const result = await readAuthorizedAdminJson(
				request(malformed),
				environment,
				{ authenticate },
			);
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.response.status).toBe(400);
		}
		const invalidUtf8 = await readAuthorizedAdminJson(
			new Request("https://example.com/api/admin/events/preview", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://example.com",
				},
				body: new Uint8Array([0xff]),
			}),
			environment,
			{ authenticate },
		);
		expect(invalidUtf8.ok).toBe(false);
		if (!invalidUtf8.ok) {
			await expect(invalidUtf8.response.json()).resolves.toMatchObject({
				code: "invalid_json",
			});
		}
	});

	it("rejects deeply nested JSON before schema validation", async () => {
		const nested = `${'{"child":'.repeat(34)}null${"}".repeat(34)}`;
		const result = await readAuthorizedAdminJson(request(nested), environment, {
			authenticate,
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
			await expect(result.response.json()).resolves.toMatchObject({
				code: "invalid_json_structure",
			});
		}
	});

	it("rejects declared and streamed bodies above hard limit", async () => {
		const declared = await readAuthorizedAdminJson(
			request("{}", { "Content-Length": "65" }),
			environment,
			{ authenticate, maximumBytes: 64 },
		);
		expect(declared.ok).toBe(false);
		if (!declared.ok) expect(declared.response.status).toBe(413);

		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(" ".repeat(40)));
				controller.enqueue(new TextEncoder().encode(" ".repeat(40)));
				controller.close();
			},
		});
		const streamed = await readAuthorizedAdminJson(
			new Request("https://example.com/api/admin/events/preview", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "https://example.com",
				},
				body: stream,
				duplex: "half",
			} as RequestInit & { duplex: "half" }),
			environment,
			{ authenticate, maximumBytes: 64 },
		);
		expect(streamed.ok).toBe(false);
		if (!streamed.ok) {
			expect(streamed.response.status).toBe(413);
			expect(streamed.response.headers.get("Cache-Control")).toBe("no-store");
		}
	});
});

function request(body: string, headers: Record<string, string> = {}) {
	return new Request("https://example.com/api/admin/events/preview", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: "https://example.com",
			...headers,
		},
		body,
	});
}
