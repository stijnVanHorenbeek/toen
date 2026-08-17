import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";
import { z } from "zod";
import {
	type SecretsStoreBinding,
	storedValue,
} from "../environment/stored-value";

export type AccessConfig = {
	teamDomain: string;
	audience: string;
};

export type AccessIdentity = {
	email: string;
};

export type AccessEnvironment = {
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_POLICY_AUD?: string;
	ACCESS_TEAM_DOMAIN_STORE?: SecretsStoreBinding;
	ACCESS_POLICY_AUD_STORE?: SecretsStoreBinding;
};

const identitySchema = z.object({ email: z.email() });
const remoteJwksByTeamDomain = new Map<string, JWTVerifyGetKey>();

export async function accessConfigFromEnvironment(
	environment: AccessEnvironment,
): Promise<AccessConfig | null> {
	const [storedTeamDomain, storedAudience] = await Promise.all([
		storedValue(
			environment.ACCESS_TEAM_DOMAIN,
			environment.ACCESS_TEAM_DOMAIN_STORE,
		),
		storedValue(
			environment.ACCESS_POLICY_AUD,
			environment.ACCESS_POLICY_AUD_STORE,
		),
	]);
	const teamDomainValue = storedTeamDomain?.trim();
	const audience = storedAudience?.trim();
	if (!teamDomainValue || !audience) return null;

	try {
		const teamDomain = new URL(teamDomainValue);
		if (
			teamDomain.protocol !== "https:" ||
			teamDomain.username ||
			teamDomain.password ||
			teamDomain.pathname !== "/" ||
			teamDomain.search ||
			teamDomain.hash
		) {
			return null;
		}
		return { teamDomain: teamDomain.origin, audience };
	} catch {
		return null;
	}
}

export async function authenticateAccessRequest(
	request: Request,
	config: AccessConfig,
	jwks?: JWTVerifyGetKey,
): Promise<AccessIdentity | null> {
	const token = request.headers.get("Cf-Access-Jwt-Assertion");
	if (!token) return null;

	try {
		const keySet = jwks ?? remoteJwks(config.teamDomain);
		const { payload } = await jwtVerify(token, keySet, {
			issuer: config.teamDomain,
			audience: config.audience,
		});
		return identitySchema.parse(payload);
	} catch {
		return null;
	}
}

function remoteJwks(teamDomain: string): JWTVerifyGetKey {
	const cached = remoteJwksByTeamDomain.get(teamDomain);
	if (cached) return cached;
	const created = createRemoteJWKSet(
		new URL(`${teamDomain}/cdn-cgi/access/certs`),
	);
	remoteJwksByTeamDomain.set(teamDomain, created);
	return created;
}
