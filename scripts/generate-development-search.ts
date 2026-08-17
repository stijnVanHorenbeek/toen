import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { toEventCatalogEntry } from "../src/lib/content/event-catalog";
import { getAllEvents } from "../src/lib/content/events";
import {
	assertSearchArtifactBudgets,
	createReleaseId,
} from "../src/lib/content/release-artifacts";
import { createEventSearchArtifact } from "../src/lib/content/search-artifact";

const execute = promisify(execFile);

async function main() {
	const appRoot = process.cwd();
	const revision = JSON.parse(
		await readFile(path.join(appRoot, "content", "revision.json"), "utf8"),
	) as { sha?: unknown };
	if (
		typeof revision.sha !== "string" ||
		!/^[0-9a-f]{40}$/.test(revision.sha)
	) {
		throw new Error("Synchronized content revision must contain a Git SHA");
	}
	const { stdout } = await execute("git", ["rev-parse", "HEAD"], {
		cwd: appRoot,
	});
	const appSha = stdout.trim();
	const releaseId = createReleaseId(appSha, revision.sha);
	const events = (await getAllEvents()).map(toEventCatalogEntry);
	const artifact = createEventSearchArtifact(events, { releaseId });
	const bytes = Buffer.from(`${JSON.stringify(artifact)}\n`);
	assertSearchArtifactBudgets(bytes);
	const publicReleases = path.join(appRoot, "public", "releases");
	const releaseDirectory = path.join(publicReleases, releaseId);
	await rm(publicReleases, { recursive: true, force: true });
	await mkdir(releaseDirectory, { recursive: true });
	await writeFile(path.join(releaseDirectory, "search.json"), bytes);
	await mkdir(path.join(appRoot, ".generated"), { recursive: true });
	await writeFile(
		path.join(appRoot, ".generated", "discovery.json"),
		`${JSON.stringify(
			{
				schemaVersion: 1,
				releaseId,
				searchIndexUrl: `/releases/${releaseId}/search.json`,
				development: true,
			},
			null,
			2,
		)}\n`,
	);
	console.log(
		JSON.stringify({
			event: "development-search-generated",
			releaseId,
			events: events.length,
			bytes: bytes.byteLength,
		}),
	);
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
