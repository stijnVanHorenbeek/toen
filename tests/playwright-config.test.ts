import { readFile } from "node:fs/promises";
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

	it("serves generated production static assets", async () => {
		const server = await readFile("scripts/start-e2e-server.sh", "utf8");
		const build = await readFile("scripts/test-e2e.sh", "utf8");

		expect(server).toContain(".generated/static-site/index.html");
		expect(server).toContain("--config wrangler.static.jsonc");
		expect(server).not.toContain(".open-next");
		expect(build).toContain("pnpm build:static:synced");
		expect(build).not.toContain("build:worker");
	});
});
