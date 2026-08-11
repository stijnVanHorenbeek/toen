import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const testDir = defineBddConfig({
	features: "features/*.feature",
	steps: "features/steps/*.ts",
});

export function createE2eServerConfig(
	environment: Readonly<Record<string, string | undefined>>,
) {
	return {
		command: "bash scripts/start-e2e-server.sh",
		url: "http://localhost:8787",
		reuseExistingServer: !environment.CI,
		timeout: 30_000,
	};
}

export default defineConfig({
	testDir,
	timeout: 10_000,
	webServer: createE2eServerConfig(process.env),
	use: {
		baseURL: "http://localhost:8787",
	},
});
