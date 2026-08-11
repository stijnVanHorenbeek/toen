import { describe, expect, it } from "vitest";
import { createE2eServerConfig } from "../playwright.config";

describe("Playwright Worker server", () => {
	it("starts an isolated Worker by default", () => {
		expect(createE2eServerConfig({}).reuseExistingServer).toBe(false);
	});

	it("reuses a local Worker only with explicit opt-in", () => {
		expect(
			createE2eServerConfig({ TOEN_E2E_REUSE_SERVER: "1" }).reuseExistingServer,
		).toBe(true);
	});

	it("never reuses a Worker in CI", () => {
		expect(
			createE2eServerConfig({ CI: "true", TOEN_E2E_REUSE_SERVER: "1" })
				.reuseExistingServer,
		).toBe(false);
	});
});
