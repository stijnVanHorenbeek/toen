import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

export async function buildBrowserWorkers({
	appRoot = process.cwd(),
	publicDirectory = path.join(appRoot, "public"),
	generatedDirectory = path.join(appRoot, ".generated"),
} = {}) {
	const result = await build({
		absWorkingDir: appRoot,
		entryPoints: [
			path.join(
				appRoot,
				"src/app/_components/event-explorer/event-search.worker.ts",
			),
		],
		bundle: true,
		format: "esm",
		legalComments: "none",
		minify: true,
		platform: "browser",
		sourcemap: false,
		target: ["es2022"],
		tsconfig: path.join(appRoot, "tsconfig.json"),
		write: false,
	});
	const output = result.outputFiles?.[0];
	if (!output || result.outputFiles?.length !== 1) {
		throw new Error("Browser Worker build must produce one JavaScript file");
	}
	const hash = createHash("sha256").update(output.contents).digest("hex");
	const filename = `event-search-${hash.slice(0, 20)}.js`;
	const workersDirectory = path.join(publicDirectory, "workers");
	await rm(workersDirectory, { recursive: true, force: true });
	await mkdir(workersDirectory, { recursive: true });
	await writeFile(path.join(workersDirectory, filename), output.contents, {
		flag: "wx",
	});
	await mkdir(generatedDirectory, { recursive: true });
	const workerUrl = `/workers/${filename}`;
	await writeFile(
		path.join(generatedDirectory, "browser-assets.json"),
		`${JSON.stringify(
			{
				schemaVersion: 1,
				eventSearchWorkerUrl: workerUrl,
				eventSearchWorkerSha256: hash,
				eventSearchWorkerBytes: output.contents.byteLength,
			},
			null,
			2,
		)}\n`,
	);
	return {
		workerUrl,
		sha256: hash,
		bytes: output.contents.byteLength,
	};
}

async function main() {
	const result = await buildBrowserWorkers();
	console.log(JSON.stringify({ event: "browser-workers-built", ...result }));
}

if (process.argv[1]?.endsWith("build-browser-workers.ts")) {
	void main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
