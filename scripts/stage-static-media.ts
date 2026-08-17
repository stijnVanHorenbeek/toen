import path from "node:path";
import { stageStaticMedia } from "../src/lib/content/static-media";

async function main() {
	const appRoot = process.cwd();
	const result = await stageStaticMedia({
		sourceRoot: appRoot,
		publicRoot: path.join(appRoot, "public"),
		generatedRoot: path.join(appRoot, ".generated"),
	});
	console.log(JSON.stringify({ event: "static-media-staged", ...result }));
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
