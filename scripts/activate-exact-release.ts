import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { computeStaticPublicSiteTreeSha256 } from "../src/lib/content/static-site";
import {
	CloudflareBuildsClient,
	isLatestReleaseBuild,
} from "../src/lib/release/cloudflare-builds";
import {
	exactReleaseBuildConfigFromEnvironment,
	releasePipelineModeFromEnvironment,
} from "../src/lib/release/release-build-config";
import {
	parseReleaseBuildReceipt,
	resolveReleaseActivationLockForBuild,
} from "../src/lib/release/release-build-runtime";

const execute = promisify(execFile);

async function main() {
	const appRoot = process.cwd();
	if (process.env.WORKERS_CI !== "1") {
		throw new Error("Exact release activation requires Workers Builds");
	}
	if (process.env.TOEN_RELEASE_ACTIVATION_APPROVED !== "1") {
		throw new Error("Exact release activation is not approved");
	}
	const buildUuid = requireEnvironment("WORKERS_CI_BUILD_UUID");
	const applicationSha = requireEnvironment("WORKERS_CI_COMMIT_SHA");
	const releaseEnvironment = {
		RELEASE_PIPELINE_MODE: process.env.RELEASE_PIPELINE_MODE as
			| "legacy"
			| "exact"
			| undefined,
		CLOUDFLARE_BUILDS_API_TOKEN: process.env.CLOUDFLARE_BUILDS_API_TOKEN,
		CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
		CLOUDFLARE_BUILD_TRIGGER_UUID: process.env.CLOUDFLARE_BUILD_TRIGGER_UUID,
		CLOUDFLARE_WORKER_TAG: process.env.CLOUDFLARE_WORKER_TAG,
		RELEASE_APPLICATION_SHA: process.env.RELEASE_APPLICATION_SHA,
	};
	const [mode, config] = await Promise.all([
		releasePipelineModeFromEnvironment(releaseEnvironment),
		exactReleaseBuildConfigFromEnvironment(releaseEnvironment),
	]);
	if (mode !== "exact" || !config) {
		throw new Error("Exact release configuration is unavailable");
	}
	const receipt = parseReleaseBuildReceipt(
		await readFile(
			path.join(appRoot, ".generated", "release-build.json"),
			"utf8",
		),
	);
	if (
		receipt.request.buildUuid !== buildUuid ||
		receipt.request.appSha !== applicationSha ||
		config.applicationSha !== applicationSha
	) {
		throw new Error("Release activation inputs do not match build receipt");
	}
	const [{ stdout: head }, { stdout: status }, treeSha256] = await Promise.all([
		execute("git", ["rev-parse", "HEAD"], { cwd: appRoot }),
		execute("git", ["status", "--porcelain"], { cwd: appRoot }),
		computeStaticPublicSiteTreeSha256(
			path.join(appRoot, ".generated", "static-site"),
		),
	]);
	if (head.trim() !== applicationSha || status.trim()) {
		throw new Error("Release checkout changed after exact build");
	}
	if (treeSha256 !== receipt.staticTreeSha256) {
		throw new Error("Static site bytes changed after release receipt");
	}
	const builds = await new CloudflareBuildsClient(config).list();
	const current = builds.find((build) => build.buildUuid === buildUuid);
	if (!current)
		throw new Error("Current release build is absent from build history");
	if (!isLatestReleaseBuild(buildUuid, builds, config)) {
		console.log(
			JSON.stringify({ event: "exact-release-superseded", buildUuid }),
		);
		return;
	}
	const activationLock = await resolveReleaseActivationLockForBuild({
		applicationSha,
		buildUuid,
		contentRepository:
			process.env.TOEN_CONTENT_REPOSITORY ?? "stijnVanHorenbeek/toen-content",
		contentBranch: process.env.TOEN_CONTENT_BRANCH ?? "main",
	});
	if (activationLock.contentSha !== receipt.request.contentSha) {
		throw new Error(
			"Release activation lock content SHA does not match receipt",
		);
	}
	await run("pnpm", [
		"exec",
		"wrangler",
		"deploy",
		"--config",
		"wrangler.static.jsonc",
	]);
	console.log(
		JSON.stringify({
			event: "exact-release-activated",
			buildUuid,
			releaseId: receipt.releaseId,
			appSha: receipt.request.appSha,
			contentSha: receipt.request.contentSha,
		}),
	);
}

function run(command: string, arguments_: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, arguments_, {
			cwd: process.cwd(),
			env: process.env,
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

void main();
