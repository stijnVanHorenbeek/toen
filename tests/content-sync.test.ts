import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import {
	parseRemoteRevision,
	publishContentRevision,
	resolveApplicationRevision,
	resolveContentRevision,
	synchronizeContent,
} from "../scripts/sync-content.mjs";

const execute = promisify(execFile);
const revisionA = "a".repeat(40);
const revisionB = "b".repeat(40);

describe("content revision resolution", () => {
	it("accepts one exact main revision from git ls-remote", () => {
		expect(parseRemoteRevision(`${revisionA}\trefs/heads/main\n`)).toBe(
			revisionA,
		);
	});

	it.each(["", "ABC", "a".repeat(39), "A".repeat(40)])(
		"rejects invalid immutable override %j",
		async (override) => {
			await expect(
				resolveContentRevision({
					repository: "ignored",
					override,
				}),
			).rejects.toThrow("valid 40-character lowercase hexadecimal SHA");
		},
	);

	it("uses a valid immutable override without resolving the branch", async () => {
		const runGit = vi.fn();

		await expect(
			resolveContentRevision({
				repository: "ignored",
				override: revisionB,
				runGit,
			}),
		).resolves.toBe(revisionB);
		expect(runGit).not.toHaveBeenCalled();
	});

	it("resolves application HEAD when a Deploy Hook supplies no commit SHA", async () => {
		const runGit = vi.fn().mockResolvedValue(`${revisionA}\n`);

		await expect(
			resolveApplicationRevision({
				appRoot: "/app",
				environmentRevision: "main",
				runGit,
			}),
		).resolves.toBe(revisionA);
		expect(runGit).toHaveBeenCalledWith(["rev-parse", "HEAD"], {
			cwd: "/app",
		});
	});
});

describe("content synchronization", () => {
	it("publishes events and their revision as one generated content root", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-content-publish-"));
		const source = path.join(root, "source");
		const target = path.join(root, "content");
		await mkdir(source, { recursive: true });
		await mkdir(path.join(target, "events"), { recursive: true });
		await writeFile(path.join(source, "new.md"), "new\n");
		await writeFile(path.join(target, "events/stale.md"), "stale\n");
		await writeFile(path.join(target, "revision.json"), "old\n");

		await publishContentRevision(source, target, revisionA);

		await expect(
			readFile(path.join(target, "events/new.md"), "utf8"),
		).resolves.toBe("new\n");
		await expect(
			readFile(path.join(target, "revision.json"), "utf8"),
		).resolves.toBe(`${JSON.stringify({ sha: revisionA }, null, "\t")}\n`);
		await expect(
			readFile(path.join(target, "events/stale.md"), "utf8"),
		).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("checks out and copies the exact resolved local Git revision", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-content-sync-"));
		const repository = path.join(root, "repository");
		const appRoot = path.join(root, "app");
		await mkdir(path.join(repository, "content/events"), { recursive: true });
		await execute("git", ["init", "-b", "main"], { cwd: repository });
		await execute("git", ["config", "user.name", "Test"], { cwd: repository });
		await execute("git", ["config", "user.email", "test@example.com"], {
			cwd: repository,
		});
		const eventPath = path.join(repository, "content/events/test-event.md");
		await writeFile(eventPath, "first\n");
		await execute("git", ["add", "."], { cwd: repository });
		await execute("git", ["commit", "-m", "first"], { cwd: repository });
		const { stdout: firstRevisionOutput } = await execute(
			"git",
			["rev-parse", "HEAD"],
			{ cwd: repository },
		);
		const firstRevision = firstRevisionOutput.trim();
		await writeFile(eventPath, "second\n");
		await execute("git", ["commit", "-am", "second"], { cwd: repository });

		const verifyCheckout = vi.fn().mockResolvedValue(undefined);
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		try {
			await synchronizeContent({
				repository,
				appRoot,
				override: firstRevision,
				verifyCheckout,
			});
		} finally {
			log.mockRestore();
		}

		await expect(
			readFile(path.join(appRoot, "content/events/test-event.md"), "utf8"),
		).resolves.toBe("first\n");
		await expect(
			readFile(path.join(appRoot, "content/revision.json"), "utf8"),
		).resolves.toBe(`${JSON.stringify({ sha: firstRevision }, null, "\t")}\n`);
		expect(verifyCheckout).toHaveBeenCalledOnce();
	});
});
