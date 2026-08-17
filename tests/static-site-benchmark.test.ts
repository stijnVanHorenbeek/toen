import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("static site benchmark", () => {
	it("reports bounded one-file output", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-static-report-"));
		const reportPath = path.join(root, "report.json");
		await execute(
			"pnpm",
			[
				"exec",
				"tsx",
				"scripts/benchmark-static-site.ts",
				"--events=12",
				`--output=${reportPath}`,
			],
			{ cwd: process.cwd(), maxBuffer: 4 * 1024 ** 2 },
		);
		const report = JSON.parse(await readFile(reportPath, "utf8"));
		expect(report).toMatchObject({
			eventCount: 12,
			gates: {
				fileHardStop: true,
				htmlTarget: true,
				noRuntimeSidecars: true,
				publicTarget: true,
			},
		});
		expect(report.htmlFileCount).toBeGreaterThanOrEqual(27);
	});
});
