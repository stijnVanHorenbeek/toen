import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const testDir = defineBddConfig({
	features: "features/*.feature",
	steps: "features/steps/*.ts",
});

export default defineConfig({
	testDir,
	timeout: 10_000,
	use: {
		baseURL: "http://localhost:8787",
	},
});
