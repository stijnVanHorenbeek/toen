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

	it("binds release commands without replacing normal deployment scripts", async () => {
		const manifest = JSON.parse(await readFile("package.json", "utf8"));
		expect(manifest.scripts["release:build"]).toContain(
			"build-exact-release.ts",
		);
		expect(manifest.scripts["release:activate"]).toContain(
			"activate-exact-release.ts",
		);
		expect(manifest.scripts.deploy).toBe(
			"pnpm build:worker && pnpm deploy:worker",
		);
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
	});
});
