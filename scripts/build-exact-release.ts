import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { computeStaticPublicSiteTreeSha256 } from "../src/lib/content/static-site";
import {
	createReleaseBuildReceipt,
	resolveReleaseRequestForBuild,
} from "../src/lib/release/release-build-runtime";

const execute = promisify(execFile);

async function main() {
	const appRoot = process.cwd();
	const buildUuid = requireEnvironment("WORKERS_CI_BUILD_UUID");
	const applicationSha = requireEnvironment("WORKERS_CI_COMMIT_SHA");
	const [{ stdout: head }, { stdout: status }] = await Promise.all([
		execute("git", ["rev-parse", "HEAD"], { cwd: appRoot }),
		execute("git", ["status", "--porcelain"], {
			cwd: appRoot,
		}),
	]);
	if (head.trim() !== applicationSha) {
		throw new Error("Workers build checkout does not match application SHA");
	}
	if (status.trim()) {
		throw new Error("Workers build checkout contains tracked changes");
	}
	const request = await resolveReleaseRequestForBuild({
		applicationSha,
		buildUuid,
		contentRepository:
			process.env.TOEN_CONTENT_REPOSITORY ?? "stijnVanHorenbeek/toen-content",
		contentBranch: process.env.TOEN_CONTENT_BRANCH ?? "main",
	});
	await run("pnpm", ["ci:build"], {
		...process.env,
		TOEN_CONTENT_SHA: request.contentSha,
	});
	const [discoveryBytes, staticManifestBytes, adminWorkerBytes] =
		await Promise.all([
			readFile(path.join(appRoot, ".generated", "discovery.json")),
			readFile(path.join(appRoot, ".generated", "static-site.json")),
			readFile(path.join(appRoot, ".generated", "admin-worker.json")),
		]);
	const discovery = requireRecord(JSON.parse(discoveryBytes.toString("utf8")));
	const staticManifest = requireRecord(
		JSON.parse(staticManifestBytes.toString("utf8")),
	);
	const adminWorker = requireRecord(
		JSON.parse(adminWorkerBytes.toString("utf8")),
	);
	const receipt = createReleaseBuildReceipt({
		request,
		releaseId: requireMatch(discovery.releaseId, /^[0-9a-f]{64}$/),
		staticFileCount: requireInteger(staticManifest.fileCount),
		staticTreeSha256: await computeStaticPublicSiteTreeSha256(
			path.join(appRoot, ".generated", "static-site"),
		),
		adminWorkerSha256: requireMatch(adminWorker.sha256, /^[0-9a-f]{64}$/),
	});
	const target = path.join(appRoot, ".generated", "release-build.json");
	const temporary = `${target}.tmp-${randomUUID()}`;
	try {
		await writeFile(temporary, `${JSON.stringify(receipt)}\n`, { flag: "wx" });
		await rename(temporary, target);
	} finally {
		await rm(temporary, { force: true });
	}
	console.log(
		JSON.stringify({
			event: "exact-release-built",
			buildUuid,
			releaseId: receipt.releaseId,
			appSha: request.appSha,
			contentSha: request.contentSha,
			integritySha256: receipt.integritySha256,
		}),
	);
}

function run(
	command: string,
	arguments_: string[],
	environment: NodeJS.ProcessEnv,
) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, arguments_, {
			cwd: process.cwd(),
			env: environment,
			stdio: "inherit",
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) resolve();
			else reject(new Error(`${command} exited with ${code ?? signal}`));
		});
	});
}

function requireEnvironment(name: string) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Generated release metadata is invalid");
	}
	return value as Record<string, unknown>;
}

function requireMatch(value: unknown, pattern: RegExp) {
	if (typeof value !== "string" || !pattern.test(value)) {
		throw new Error("Generated release metadata is invalid");
	}
	return value;
}

function requireInteger(value: unknown) {
	if (!Number.isSafeInteger(value) || (value as number) < 1) {
		throw new Error("Generated release metadata is invalid");
	}
	return value as number;
}

void main();
