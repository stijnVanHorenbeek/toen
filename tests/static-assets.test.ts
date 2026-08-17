import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Static Assets cache policy", () => {
	it("marks only content-addressed and release-qualified assets immutable", async () => {
		const headers = await readFile("public/_headers", "utf8");

		for (const pattern of [
			"/_next/static/*",
			"/media/assets/*",
			"/releases/*",
			"/workers/event-search-*",
		]) {
			expect(headers).toContain(
				`${pattern}\n  Cache-Control: public,max-age=31536000,immutable`,
			);
		}
		expect(headers).not.toContain("/media/sources/*");
	});
});
