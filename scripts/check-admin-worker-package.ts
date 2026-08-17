import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

const execute = promisify(execFile);

async function main() {
	const outputDirectory = await mkdtemp(
		path.join(tmpdir(), "toen-admin-worker-package-"),
	);
	try {
		await execute(
			"pnpm",
			[
				"exec",
				"wrangler",
				"deploy",
				"--config",
				"wrangler.admin.jsonc",
				"--dry-run",
				"--outdir",
				outputDirectory,
			],
			{ cwd: process.cwd(), maxBuffer: 16 * 1024 ** 2 },
		);
		const bytes = await readFile(path.join(outputDirectory, "admin-api.js"));
		const gzipBytes = gzipSync(bytes, { level: 9 }).byteLength;
		if (gzipBytes >= 1024 ** 2) {
			throw new Error(
				`Packaged admin Worker gzip size ${gzipBytes} exceeds 1 MiB target`,
			);
		}
		if (bytes.byteLength >= 3 * 1024 ** 2) {
			throw new Error(
				`Packaged admin Worker size ${bytes.byteLength} exceeds 3 MiB guard`,
			);
		}
		console.log(
			JSON.stringify({
				event: "admin-worker-package-checked",
				bytes: bytes.byteLength,
				gzipBytes,
			}),
		);
	} finally {
		await rm(outputDirectory, { recursive: true, force: true });
	}
}

void main();
