import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import playwrightConfig, { createE2eServerConfig } from "../playwright.config";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("Playwright Worker server", () => {
	it("keeps browser journeys on the local Worker", () => {
		expect(playwrightConfig.use?.baseURL).toBe("http://localhost:8787");
	});

	it("builds the current Worker before browser journeys", () => {
		expect(packageJson.scripts["test:e2e"]).toMatch(/^pnpm build:worker &&/);
	});

	it("reuses the Herdr development server outside CI", () => {
		expect(createE2eServerConfig({})).toMatchObject({
			command: "bash scripts/start-e2e-server.sh",
			url: "http://localhost:8787",
			reuseExistingServer: true,
		});
	});

	it("starts an isolated Worker server in CI", () => {
		expect(createE2eServerConfig({ CI: "true" })).toMatchObject({
			command: "bash scripts/start-e2e-server.sh",
			url: "http://localhost:8787",
			reuseExistingServer: false,
		});
	});
});
