import path from "node:path";
import { stagePublicRelease } from "../src/lib/content/release-public-stage";

async function main() {
	const appRoot = process.cwd();
	const result = await stagePublicRelease({
		releaseDirectory: path.join(appRoot, ".generated", "release"),
		publicDirectory: path.join(appRoot, "public"),
		generatedDirectory: path.join(appRoot, ".generated"),
	});
	console.log(JSON.stringify({ event: "public-release-staged", ...result }));
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
