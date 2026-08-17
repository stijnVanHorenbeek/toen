import { writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { generateKeyPair, SignJWT } from "jose";
import {
	type AccessConfig,
	authenticateAccessRequest,
} from "../src/lib/access/authenticate-access";
import { handlePreviewEventRequest } from "../src/lib/admin/preview-event-handler";
import { buildAdminWorker } from "./build-admin-worker";

const draft = {
	title: "Constantinopel valt",
	date: { year: 1453, era: "ce", precision: "day", month: 5, day: 29 },
	summary: "Ottomaanse troepen nemen Constantinopel in.",
	topics: ["politiek"],
	profiles: ["algemeen"],
	sources: [
		{
			title: "Fall of Constantinople",
			publisher: "Encyclopaedia Britannica",
			url: "https://www.britannica.com/event/Fall-of-Constantinople-1453",
		},
	],
	body: "De stad werd na een beleg ingenomen.",
};

async function main() {
	const { iterations, outputPath } = parseArguments(process.argv.slice(2));
	const worker = await buildAdminWorker();
	const environment = {
		ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
		ACCESS_POLICY_AUD: "benchmark-audience",
	};
	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const accessToken = await new SignJWT({ email: "benchmark@example.com" })
		.setProtectedHeader({ alg: "RS256", kid: "benchmark-key" })
		.setIssuer(environment.ACCESS_TEAM_DOMAIN)
		.setAudience(environment.ACCESS_POLICY_AUD)
		.setIssuedAt()
		.setExpirationTime("10m")
		.sign(privateKey);
	const dependencies = {
		accessToken,
		authenticate: (request: Request, config: AccessConfig) =>
			authenticateAccessRequest(request, config, async () => publicKey),
	};
	for (let index = 0; index < 100; index += 1) {
		await runPreview(environment, dependencies);
	}
	const samples: number[] = [];
	for (let index = 0; index < iterations; index += 1) {
		const startedAt = performance.now();
		await runPreview(environment, dependencies);
		samples.push(performance.now() - startedAt);
	}
	samples.sort((left, right) => left - right);
	const p95Milliseconds = samples[Math.ceil(samples.length * 0.95) - 1] ?? 0;
	const report = {
		schemaVersion: 1,
		iterations,
		p95Milliseconds,
		maximumMilliseconds: samples.at(-1) ?? 0,
		workerBytes: worker.bytes,
		workerGzipBytes: worker.gzipBytes,
		gates: {
			p95CpuTarget: p95Milliseconds < 5,
			workerSizeTarget: worker.gzipBytes < 1024 ** 2,
		},
	};
	await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
	console.log(JSON.stringify(report));
	if (Object.values(report.gates).some((passed) => !passed)) {
		throw new Error("Admin API benchmark failed required gates");
	}
}

async function runPreview(
	environment: {
		ACCESS_TEAM_DOMAIN: string;
		ACCESS_POLICY_AUD: string;
	},
	dependencies: {
		accessToken: string;
		authenticate: (
			request: Request,
			config: AccessConfig,
		) => ReturnType<typeof authenticateAccessRequest>;
	},
) {
	const response = await handlePreviewEventRequest(
		new Request("https://toen.stijnvh.workers.dev/api/admin/events/preview", {
			method: "POST",
			headers: {
				"Cf-Access-Jwt-Assertion": dependencies.accessToken,
				"Content-Type": "application/json",
				Origin: "https://toen.stijnvh.workers.dev",
			},
			body: JSON.stringify(draft),
		}),
		environment,
		dependencies,
	);
	if (response.status !== 200) {
		throw new Error(`Admin preview benchmark returned ${response.status}`);
	}
}

function parseArguments(arguments_: string[]) {
	let iterations = 1_000;
	let outputPath = "/tmp/toen-admin-api-benchmark.json";
	for (const argument of arguments_) {
		if (argument === "--") continue;
		if (argument.startsWith("--iterations=")) {
			iterations = Number(argument.slice("--iterations=".length));
		} else if (argument.startsWith("--output=")) {
			outputPath = path.resolve(argument.slice("--output=".length));
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (
		!Number.isSafeInteger(iterations) ||
		iterations < 10 ||
		iterations > 10_000
	) {
		throw new Error("--iterations must be an integer from 10 through 10000");
	}
	return { iterations, outputPath };
}

void main();
