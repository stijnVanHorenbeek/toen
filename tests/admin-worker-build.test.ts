import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAdminWorker } from "../scripts/build-admin-worker";

describe("native admin Worker build", () => {
	it("produces a bounded deterministic bundle without OpenNext or Markdown", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-admin-worker-"));
		const outputDirectory = path.join(root, ".generated", "workers");
		const first = await buildAdminWorker({
			appRoot: process.cwd(),
			outputDirectory,
		});
		const firstBytes = await readFile(first.outputPath);
		const second = await buildAdminWorker({
			appRoot: process.cwd(),
			outputDirectory,
		});
		const secondBytes = await readFile(second.outputPath);
		expect(secondBytes).toEqual(firstBytes);
		expect(first.gzipBytes).toBeLessThan(1024 ** 2);
		expect(first.sha256).toBe(
			createHash("sha256").update(firstBytes).digest("hex"),
		);
		expect(firstBytes.toString("utf8")).not.toContain(".open-next");
		expect(firstBytes.toString("utf8")).not.toContain("tests/fixtures");
	});
});
