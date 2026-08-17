import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBrowserWorkers } from "../scripts/build-browser-workers";
import { readBrowserAssetPointer } from "../src/lib/content/browser-assets";

describe("browser Worker build", () => {
	it("emits deterministic bundled JavaScript with a verified pointer", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-browser-worker-"));
		const publicDirectory = path.join(root, "public");
		const generatedDirectory = path.join(root, ".generated");
		const options = {
			appRoot: process.cwd(),
			publicDirectory,
			generatedDirectory,
		};

		const first = await buildBrowserWorkers(options);
		const second = await buildBrowserWorkers(options);
		const pointer = await readBrowserAssetPointer(root);
		const output = await readFile(
			path.join(publicDirectory, first.workerUrl.slice(1)),
			"utf8",
		);

		expect(second).toEqual(first);
		expect(pointer).toEqual({
			eventSearchWorkerUrl: first.workerUrl,
			eventSearchWorkerSha256: first.sha256,
			eventSearchWorkerBytes: first.bytes,
		});
		expect(output).not.toContain('from "@/');
		expect(output).not.toContain("type EventSearch");
		expect(output).toContain("onmessage");
		expect(first.bytes).toBeLessThan(128 * 1024);
		await writeFile(
			path.join(publicDirectory, first.workerUrl.slice(1)),
			`${output}\n// tampered`,
		);
		await expect(readBrowserAssetPointer(root)).rejects.toThrow(
			"does not match checksum pointer",
		);
	});
});
