import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

export async function buildAdminWorker({
	appRoot = process.cwd(),
	outputDirectory = path.join(appRoot, ".generated", "workers"),
} = {}) {
	const result = await build({
		absWorkingDir: appRoot,
		bundle: true,
		conditions: ["worker", "browser"],
		define: { "process.env.NODE_ENV": '"production"' },
		entryPoints: ["src/workers/admin-api.ts"],
		external: ["node:crypto"],
		format: "esm",
		legalComments: "none",
		metafile: true,
		minify: true,
		outfile: "admin-api.js",
		platform: "neutral",
		sourcemap: false,
		target: ["es2022"],
		tsconfig: "tsconfig.json",
		write: false,
	});
	const output = result.outputFiles[0];
	if (!output) throw new Error("Admin Worker build produced no output");
	const forbiddenInput = Object.keys(result.metafile.inputs).find(
		(input) =>
			input.endsWith(".md") ||
			input.includes("content/events/") ||
			input.includes("@opennextjs/") ||
			input.includes("next/dist/"),
	);
	if (forbiddenInput) {
		throw new Error(
			`Admin Worker contains forbidden runtime input: ${forbiddenInput}`,
		);
	}
	const bytes = output.contents.byteLength;
	const gzipBytes = gzipSync(output.contents, { level: 9 }).byteLength;
	if (gzipBytes >= 1024 ** 2) {
		throw new Error(`Admin Worker gzip size ${gzipBytes} exceeds 1 MiB target`);
	}
	if (bytes >= 3 * 1024 ** 2) {
		throw new Error(`Admin Worker raw size ${bytes} exceeds 3 MiB guard`);
	}
	const sha256 = createHash("sha256").update(output.contents).digest("hex");
	await mkdir(outputDirectory, { recursive: true });
	const outputPath = path.join(outputDirectory, "admin-api.js");
	const temporaryPath = `${outputPath}.tmp-${randomUUID()}`;
	const pointerPath = path.join(
		path.dirname(outputDirectory),
		"admin-worker.json",
	);
	const temporaryPointer = `${pointerPath}.tmp-${randomUUID()}`;
	try {
		await writeFile(temporaryPath, output.contents, { flag: "wx" });
		await rename(temporaryPath, outputPath);
		await writeFile(
			temporaryPointer,
			`${JSON.stringify({ schemaVersion: 1, path: ".generated/workers/admin-api.js", sha256, bytes, gzipBytes })}\n`,
			{ flag: "wx" },
		);
		await rename(temporaryPointer, pointerPath);
	} finally {
		await Promise.all([
			rm(temporaryPath, { force: true }),
			rm(temporaryPointer, { force: true }),
		]);
	}
	return { bytes, gzipBytes, sha256, outputPath };
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	buildAdminWorker().then((result) => {
		console.log(JSON.stringify({ event: "admin-worker-built", ...result }));
	});
}
