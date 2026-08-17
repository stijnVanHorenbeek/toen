import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production admin Worker topology", () => {
	it("routes admin APIs to a private production service without exposing that service", async () => {
		const publicConfig = JSON.parse(
			await readFile(path.join(process.cwd(), "wrangler.static.jsonc"), "utf8"),
		);
		const adminConfig = JSON.parse(
			await readFile(path.join(process.cwd(), "wrangler.admin.jsonc"), "utf8"),
		);
		const packageManifest = JSON.parse(
			await readFile(path.join(process.cwd(), "package.json"), "utf8"),
		);
		const workflow = await readFile(
			path.join(process.cwd(), ".github/workflows/verify.yml"),
			"utf8",
		);
		expect(publicConfig).toMatchObject({
			name: "toen",
			main: "src/workers/public-router.ts",
			workers_dev: true,
			preview_urls: false,
			assets: {
				binding: "ASSETS",
				run_worker_first: ["/api/admin/*"],
			},
			services: [{ binding: "ADMIN_API", service: "toen-admin" }],
		});
		expect(adminConfig).toMatchObject({
			name: "toen-admin",
			main: ".generated/workers/admin-api.js",
			workers_dev: false,
			preview_urls: false,
		});
		expect(adminConfig.routes).toBeUndefined();
		expect(packageManifest.scripts["ci:build"]).toContain(
			"pnpm assets:admin:check",
		);
		expect(packageManifest.scripts["ci:build"]).toContain("pnpm static:check");
		expect(workflow).toContain("run: pnpm ci:build");
		expect(
			adminConfig.secrets_store_secrets.map(
				(binding: { binding: string }) => binding.binding,
			),
		).toEqual(["ACCESS_TEAM_DOMAIN_STORE", "ACCESS_POLICY_AUD_STORE"]);
	});
});
