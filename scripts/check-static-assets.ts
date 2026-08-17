import path from "node:path";
import {
	assertStaticAssetFileCount,
	countStaticAssetFiles,
} from "../src/lib/content/static-asset-budget";

async function main() {
	const root = path.join(process.cwd(), ".open-next", "assets");
	const fileCount = await countStaticAssetFiles(root);
	assertStaticAssetFileCount(fileCount);
	console.log(JSON.stringify({ event: "static-assets-checked", fileCount }));
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
