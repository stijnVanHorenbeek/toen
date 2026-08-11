import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import playwrightConfig, { createE2eServerConfig } from "../playwright.config";

const packageJson = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };

describe("Playwright Worker server", () => {
	it("keeps browser journeys on the local Worker", () => {
		expect(playwrightConfig.use?.baseURL).toBe("http://localhost:8787");
	});

	it("builds the Worker from the pinned Apollo content revision", () => {
		const scriptUrl = new URL("../scripts/test-e2e.sh", import.meta.url);
		expect(existsSync(scriptUrl)).toBe(true);
		const script = existsSync(scriptUrl) ? readFileSync(scriptUrl, "utf8") : "";

		expect(packageJson.scripts["test:e2e"]).toBe("bash scripts/test-e2e.sh");
		expect(script).toContain("f6c5ad91b9aaf4c91cd5fef2bdf23736386f054d");
		expect(script).toContain("TOEN_CONTENT_SHA");
		expect(script).toContain("pnpm build:worker");
		expect(script).toContain("pnpm exec playwright test");
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
