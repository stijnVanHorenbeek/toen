import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import {
	type AccessConfig,
	accessConfigFromEnvironment,
	authenticateAccessRequest,
} from "../src/lib/access/authenticate-access";

const config: AccessConfig = {
	teamDomain: "https://example.cloudflareaccess.com",
	audience: "application-audience",
};

describe("accessConfigFromEnvironment", () => {
	it("reads Access configuration from Secrets Store bindings", async () => {
		const teamDomain = {
			get: vi.fn().mockResolvedValue("https://example.cloudflareaccess.com"),
		};
		const audience = {
			get: vi.fn().mockResolvedValue("application-audience"),
		};

		await expect(
			accessConfigFromEnvironment({
				ACCESS_TEAM_DOMAIN_STORE: teamDomain,
				ACCESS_POLICY_AUD_STORE: audience,
			}),
		).resolves.toEqual(config);
		expect(teamDomain.get).toHaveBeenCalledOnce();
		expect(audience.get).toHaveBeenCalledOnce();
	});

	it("rejects a malformed or insecure team domain", async () => {
		await expect(
			accessConfigFromEnvironment({
				ACCESS_TEAM_DOMAIN: "not-a-url",
				ACCESS_POLICY_AUD: "application-audience",
			}),
		).resolves.toBeNull();
		await expect(
			accessConfigFromEnvironment({
				ACCESS_TEAM_DOMAIN: "http://example.cloudflareaccess.com",
				ACCESS_POLICY_AUD: "application-audience",
			}),
		).resolves.toBeNull();
	});
});

describe("authenticateAccessRequest", () => {
	it("returns authenticated email from a valid Access token", async () => {
		const { request, jwks } = await createAccessRequest({
			email: "editor@example.com",
		});

		await expect(
			authenticateAccessRequest(request, config, jwks),
		).resolves.toEqual({ email: "editor@example.com" });
	});

	it("rejects a token issued for another Access application", async () => {
		const { request, jwks } = await createAccessRequest({
			email: "editor@example.com",
			audience: "another-application",
		});

		await expect(
			authenticateAccessRequest(request, config, jwks),
		).resolves.toBeNull();
	});

	it("rejects a token from another issuer", async () => {
		const { request, jwks } = await createAccessRequest({
			email: "editor@example.com",
			issuer: "https://other.cloudflareaccess.com",
		});

		await expect(
			authenticateAccessRequest(request, config, jwks),
		).resolves.toBeNull();
	});

	it("rejects a token without a valid email", async () => {
		const { request, jwks } = await createAccessRequest({ email: "invalid" });

		await expect(
			authenticateAccessRequest(request, config, jwks),
		).resolves.toBeNull();
	});

	it("rejects a request without an Access token", async () => {
		await expect(
			authenticateAccessRequest(new Request("https://example.com"), config),
		).resolves.toBeNull();
	});
});

async function createAccessRequest({
	audience = config.audience,
	email,
	issuer = config.teamDomain,
}: {
	audience?: string;
	email: string;
	issuer?: string;
}) {
	const { privateKey, publicKey } = await generateKeyPair("RS256", {
		extractable: true,
	});
	const publicJwk = await exportJWK(publicKey);
	publicJwk.kid = "test-key";
	publicJwk.alg = "RS256";
	const token = await new SignJWT({ email })
		.setProtectedHeader({ alg: "RS256", kid: "test-key" })
		.setIssuer(issuer)
		.setAudience(audience)
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(privateKey);

	return {
		request: new Request("https://example.com", {
			headers: { "Cf-Access-Jwt-Assertion": token },
		}),
		jwks: createLocalJWKSet({ keys: [publicJwk] }),
	};
}
