import { createPrivateKey } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import { type GitHubFetch, requestGitHub } from "./github-request";

export type GitHubAppCredentials = {
	appId: string;
	installationId: string;
	privateKey: string;
};

const installationTokenSchema = z.object({ token: z.string().min(1) });

export async function createInstallationToken({
	credentials,
	fetch,
	repository,
}: {
	credentials: GitHubAppCredentials;
	fetch: GitHubFetch;
	repository: string;
}): Promise<string> {
	const appToken = await createAppToken(credentials);
	const result = await requestGitHub({
		fetch,
		method: "POST",
		url: `https://api.github.com/app/installations/${credentials.installationId}/access_tokens`,
		token: appToken,
		body: {
			repositories: [repository],
			permissions: {
				contents: "write",
			},
		},
		schema: installationTokenSchema,
	});
	return result.token;
}

async function createAppToken({
	appId,
	privateKey,
}: GitHubAppCredentials): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const key = await importPKCS8(normalizePrivateKey(privateKey), "RS256");

	return new SignJWT({})
		.setProtectedHeader({ alg: "RS256" })
		.setIssuer(appId)
		.setIssuedAt(now - 60)
		.setExpirationTime(now + 9 * 60)
		.sign(key);
}

function normalizePrivateKey(value: string): string {
	const normalized = value.replaceAll("\\n", "\n").trim();
	if (!normalized.includes("BEGIN RSA PRIVATE KEY")) return normalized;

	return createPrivateKey(normalized)
		.export({ format: "pem", type: "pkcs8" })
		.toString();
}
