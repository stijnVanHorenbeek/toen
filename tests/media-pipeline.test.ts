import { createHash } from "node:crypto";
import {
	cp,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { historicalVisuals } from "../src/lib/content/event-media";
import {
	inspectSanitizedWebP,
	stageStaticMedia,
} from "../src/lib/content/static-media";
import { verifyStaticMediaBuild } from "../src/lib/content/static-media-build";
import { historicalVisualSourcePaths } from "../src/lib/content/static-media-sources";

describe("static media pipeline", () => {
	it("stages one verified content-addressed WebP per media ID", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-media-stage-"));
		const publicRoot = path.join(root, "public");
		const generatedRoot = path.join(root, ".generated");
		const result = await stageStaticMedia({
			sourceRoot: process.cwd(),
			publicRoot,
			generatedRoot,
		});

		expect(result.fileCount).toBe(Object.keys(historicalVisuals).length);
		for (const [id, visual] of Object.entries(historicalVisuals)) {
			const target = path.join(publicRoot, visual.src.slice(1));
			const bytes = await readFile(target);
			expect(createHash("sha256").update(bytes).digest("hex")).toBe(
				visual.sha256,
			);
			expect(result.media[id]).toMatchObject({
				path: visual.src,
				width: visual.width,
				height: visual.height,
				sha256: visual.sha256,
			});
		}
		const pointer = JSON.parse(
			await readFile(path.join(generatedRoot, "media-assets.json"), "utf8"),
		);
		expect(() => verifyStaticMediaBuild(pointer, root)).not.toThrow();
		const extra = path.join(publicRoot, "media/assets/extra.webp");
		await writeFile(extra, "extra");
		expect(() => verifyStaticMediaBuild(pointer, root)).toThrow(
			"directory or totals",
		);
		await rm(extra);
	});

	it("keeps committed output active when obsolete backup cleanup fails", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-media-cleanup-"));
		const publicRoot = path.join(root, "public");
		const generatedRoot = path.join(root, ".generated");
		await stageStaticMedia({
			sourceRoot: process.cwd(),
			publicRoot,
			generatedRoot,
		});
		await writeFile(path.join(publicRoot, "media/assets/obsolete"), "old");
		const warning = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		try {
			await expect(
				stageStaticMedia({
					sourceRoot: process.cwd(),
					publicRoot,
					generatedRoot,
					removePath: async (target, options) => {
						if (String(target).includes(".media-assets-backup-")) {
							throw new Error("injected cleanup failure");
						}
						await rm(target, options);
					},
				}),
			).resolves.toMatchObject({ fileCount: 4 });
		} finally {
			warning.mockRestore();
		}
		await expect(
			readFile(path.join(publicRoot, "media/assets/obsolete")),
		).rejects.toMatchObject({ code: "ENOENT" });
		const pointer = JSON.parse(
			await readFile(path.join(generatedRoot, "media-assets.json"), "utf8"),
		);
		expect(pointer.fileCount).toBe(4);
	});

	it("rejects parent and output symlinks", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-media-parent-link-"));
		await mkdir(path.join(root, "media"));
		await symlink(
			path.join(process.cwd(), "media/sources"),
			path.join(root, "media/sources"),
			"dir",
		);
		await expect(
			stageStaticMedia({
				sourceRoot: root,
				publicRoot: path.join(root, "public"),
				generatedRoot: path.join(root, ".generated"),
			}),
		).rejects.toThrow("Media source directory must be a real directory");

		const realPublic = path.join(root, "real-public");
		await mkdir(realPublic);
		const linkedPublic = path.join(root, "linked-public");
		await symlink(realPublic, linkedPublic, "dir");
		await expect(
			stageStaticMedia({
				sourceRoot: process.cwd(),
				publicRoot: linkedPublic,
				generatedRoot: path.join(root, "generated"),
			}),
		).rejects.toThrow("Public media root must be a real directory");
	});

	it("rejects a source symlink that escapes trusted media directory", async () => {
		const root = await mkdtemp(path.join(tmpdir(), "toen-media-link-"));
		const sourceDirectory = path.join(root, "media", "sources");
		await cp(path.join(process.cwd(), "media", "sources"), sourceDirectory, {
			recursive: true,
		});
		const linkedSource = path.join(sourceDirectory, "apollo-11-aldrin.webp");
		await rm(linkedSource);
		await symlink(
			path.join(process.cwd(), "media/sources/apollo-11-aldrin.webp"),
			linkedSource,
		);

		await expect(
			stageStaticMedia({
				sourceRoot: root,
				publicRoot: path.join(root, "public"),
				generatedRoot: path.join(root, ".generated"),
			}),
		).rejects.toThrow("escapes trusted directory");
	});

	it("rejects metadata chunks and never overwrites a conflicting hash path", async () => {
		const visual = historicalVisuals["apollo-11-aldrin"];
		const source = await readFile(
			path.join(process.cwd(), historicalVisualSourcePaths["apollo-11-aldrin"]),
		);
		const metadataChunk = Buffer.alloc(12);
		metadataChunk.write("EXIF", 0, "ascii");
		metadataChunk.writeUInt32LE(4, 4);
		metadataChunk.write("test", 8, "ascii");
		const withMetadata = Buffer.concat([source, metadataChunk]);
		withMetadata.writeUInt32LE(withMetadata.byteLength - 8, 4);
		expect(() => inspectSanitizedWebP(withMetadata)).toThrow("metadata chunk");
		const interframe = Buffer.from(source);
		interframe[20] = (interframe[20] ?? 0) | 1;
		expect(() => inspectSanitizedWebP(interframe)).toThrow("keyframe header");

		const root = await mkdtemp(path.join(tmpdir(), "toen-media-conflict-"));
		const publicRoot = path.join(root, "public");
		const generatedRoot = path.join(root, ".generated");
		await stageStaticMedia({
			sourceRoot: process.cwd(),
			publicRoot,
			generatedRoot,
		});
		const target = path.join(publicRoot, visual.src.slice(1));
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, "tampered");

		await expect(
			stageStaticMedia({
				sourceRoot: process.cwd(),
				publicRoot,
				generatedRoot,
			}),
		).rejects.toThrow("Existing immutable media asset differs");
	});
});
