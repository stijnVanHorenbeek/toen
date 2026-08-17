import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { STATIC_ASSET_CI_HARD_STOP } from "./release-artifacts";

export function assertStaticAssetFileCount(fileCount: number): void {
	if (!Number.isSafeInteger(fileCount) || fileCount < 0) {
		throw new Error("Static Asset file count must be a non-negative integer");
	}
	if (fileCount > STATIC_ASSET_CI_HARD_STOP) {
		throw new Error(
			`Static Assets output ${fileCount} exceeds ${STATIC_ASSET_CI_HARD_STOP}-file CI hard stop`,
		);
	}
}

export async function countStaticAssetFiles(root: string): Promise<number> {
	const metadata = await lstat(root);
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error("Static Assets root must be a real directory");
	}
	let fileCount = 0;
	const pending = [root];
	while (pending.length > 0) {
		const directory = pending.pop();
		if (!directory) break;
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const entryPath = path.join(directory, entry.name);
			if (entry.isSymbolicLink()) {
				throw new Error(`Static Assets output contains symlink: ${entryPath}`);
			}
			if (entry.isDirectory()) pending.push(entryPath);
			else if (entry.isFile()) fileCount += 1;
			else
				throw new Error(
					`Static Assets output contains unsupported entry: ${entryPath}`,
				);
		}
	}
	return fileCount;
}
