import type {
	AccessConfig,
	AccessEnvironment,
	AccessIdentity,
} from "../access/authenticate-access";
import {
	accessConfigFromEnvironment,
	authenticateAccessRequest,
} from "../access/authenticate-access";
import { messages } from "../i18n/messages.nl-BE";

export const maximumAdminRequestBytes = 256 * 1024;

type Dependencies = {
	authenticate?: (
		request: Request,
		config: AccessConfig,
	) => Promise<AccessIdentity | null>;
	maximumBytes?: number;
};

type AuthorizedJsonResult =
	| { ok: true; identity: AccessIdentity; value: unknown }
	| { ok: false; response: Response };

export async function readAuthorizedAdminJson(
	request: Request,
	environment: AccessEnvironment,
	dependencies: Dependencies = {},
): Promise<AuthorizedJsonResult> {
	let accessConfig: AccessConfig | null;
	try {
		accessConfig = await accessConfigFromEnvironment(environment);
	} catch {
		return rejectRequest(
			request,
			messages.api.adminConfigUnavailable,
			503,
			"admin_config_unavailable",
		);
	}
	if (!accessConfig) {
		return rejectRequest(
			request,
			messages.api.adminNotConfigured,
			503,
			"admin_not_configured",
		);
	}
	const authenticate = dependencies.authenticate ?? authenticateAccessRequest;
	const identity = await authenticate(request, accessConfig);
	if (!identity) {
		return rejectRequest(
			request,
			messages.api.unauthorized,
			401,
			"unauthorized",
		);
	}

	let requestOrigin: string;
	try {
		requestOrigin = new URL(request.url).origin;
	} catch {
		return rejectRequest(
			request,
			messages.api.invalidOrigin,
			403,
			"invalid_origin",
		);
	}
	if (request.headers.get("Origin") !== requestOrigin) {
		return rejectRequest(
			request,
			messages.api.invalidOrigin,
			403,
			"invalid_origin",
		);
	}
	const mediaType = request.headers
		.get("Content-Type")
		?.split(";", 1)[0]
		?.trim()
		.toLowerCase();
	if (mediaType !== "application/json") {
		return rejectRequest(
			request,
			messages.api.unsupportedMedia,
			415,
			"unsupported_media_type",
		);
	}
	const maximumBytes = dependencies.maximumBytes ?? maximumAdminRequestBytes;
	const contentLength = request.headers.get("Content-Length");
	if (contentLength !== null) {
		if (!/^\d+$/.test(contentLength)) {
			return rejectRequest(
				request,
				messages.errors.invalidJson,
				400,
				"invalid_content_length",
			);
		}
		if (Number(contentLength) > maximumBytes) {
			return rejectRequest(
				request,
				messages.api.requestTooLarge,
				413,
				"request_too_large",
			);
		}
	}
	try {
		const bytes = await readBoundedBody(request, maximumBytes);
		const value: unknown = JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(bytes),
		);
		if (!hasBoundedJsonStructure(value)) {
			return rejected(
				messages.errors.invalidJson,
				400,
				"invalid_json_structure",
			);
		}
		return { ok: true, identity, value };
	} catch (error) {
		if (error instanceof RequestTooLargeError) {
			return rejected(messages.api.requestTooLarge, 413, "request_too_large");
		}
		return rejected(messages.errors.invalidJson, 400, "invalid_json");
	}
}

export function adminJsonResponse(
	body: unknown,
	init: ResponseInit = {},
): Response {
	const headers = new Headers(init.headers);
	headers.set("Cache-Control", "no-store");
	return Response.json(body, { ...init, headers });
}

async function readBoundedBody(
	request: Request,
	maximumBytes: number,
): Promise<Uint8Array> {
	if (!request.body) return new Uint8Array();
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maximumBytes) {
			await reader.cancel();
			throw new RequestTooLargeError();
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

function hasBoundedJsonStructure(value: unknown) {
	const pending: Array<{ depth: number; value: unknown }> = [
		{ depth: 0, value },
	];
	let nodes = 0;
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		nodes += 1;
		if (nodes > 10_000 || current.depth > 32) return false;
		if (!current.value || typeof current.value !== "object") continue;
		for (const child of Object.values(current.value)) {
			pending.push({ depth: current.depth + 1, value: child });
		}
	}
	return true;
}

async function rejectRequest(
	request: Request,
	error: string,
	status: number,
	code: string,
) {
	await cancelUnreadRequestBody(request);
	return rejected(error, status, code);
}

export async function cancelUnreadRequestBody(request: Request): Promise<void> {
	if (request.body && !request.bodyUsed) {
		await request.body.cancel().catch(() => undefined);
	}
}

function rejected(error: string, status: number, code: string) {
	return {
		ok: false as const,
		response: adminJsonResponse({ code, error }, { status }),
	};
}

class RequestTooLargeError extends Error {}
