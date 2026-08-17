import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	assertStaticAssetFileCount,
	countStaticAssetFiles,
} from "../src/lib/content/static-asset-budget";

describe("final Static Assets budget", () => {
	it("enforces the 18,000-file post-build hard stop", () => {
		expect(() => assertStaticAssetFileCount(18_000)).not.toThrow();
		expect(() => assertStaticAssetFileCount(18_001)).toThrow(
			"18000-file CI hard stop",
		);
	});

	it("counts regular files recursively and rejects symlinks", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-static-assets-"));
		await mkdir(path.join(root, "nested"));
		await writeFile(path.join(root, "one"), "one");
		await writeFile(path.join(root, "nested", "two"), "two");
		await expect(countStaticAssetFiles(root)).resolves.toBe(2);
		await symlink(path.join(root, "one"), path.join(root, "linked"));
		await expect(countStaticAssetFiles(root)).rejects.toThrow(
			"contains symlink",
		);
	});
});
