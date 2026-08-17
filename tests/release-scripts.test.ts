import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("exact release scripts", () => {
	it("refuses activation outside explicitly approved Workers Build", async () => {
		await expect(
			execute("pnpm", ["exec", "tsx", "scripts/activate-exact-release.ts"], {
				cwd: process.cwd(),
				env: { ...process.env, WORKERS_CI: "0" },
			}),
		).rejects.toMatchObject({
			stderr: expect.stringContaining(
				"Exact release activation requires Workers Builds",
			),
		});
	});

	it("binds exact release and explicit static deployment commands", async () => {
		const manifest = JSON.parse(await readFile("package.json", "utf8"));
		const runbook = await readFile("docs/release-hardening.md", "utf8");
		expect(manifest.scripts["release:build"]).toContain(
			"build-exact-release.ts",
		);
		expect(manifest.scripts["release:activate"]).toContain(
			"activate-exact-release.ts",
		);
		expect(manifest.scripts["deploy:admin"]).toContain("wrangler.admin.jsonc");
		expect(manifest.scripts["deploy:static"]).toContain(
			"wrangler.static.jsonc",
		);
		for (const retired of [
			"assets:check",
			"build:worker",
			"build:worker:synced",
			"deploy",
			"deploy:worker",
			"upload",
			"preview",
		]) {
			expect(manifest.scripts[retired]).toBeUndefined();
		}
		expect(manifest.scripts["ci:build"]).toContain("build:static:synced");
		expect(manifest.scripts["ci:build"]).not.toContain("opennext");
		const contract = JSON.parse(
			await readFile("config/release-trigger.v1.json", "utf8"),
		);
		expect(contract).toMatchObject({
			buildCommand: "pnpm release:build",
			deployCommand: "pnpm release:activate",
			applicationBranch: "main",
		});
		expect(contract.requiredBuildEnvironment).toContain(
			"TOEN_RELEASE_ACTIVATION_APPROVED",
		);
		expect(runbook).toContain("wrangler rollback <VERSION_ID> --name toen");
	});
});
