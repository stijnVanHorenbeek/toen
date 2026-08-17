import {
	createRecommendationEngine,
	type RankedEvent,
	type RecommendationEngine,
	type RecommendationPreferences,
} from "./recommend-events";
import {
	EVENT_SEARCH_MAX_BYTES,
	hydrateEventSearchEntries,
	parseEventSearchArtifact,
} from "./search-artifact";

const releaseSearchPathPattern = /^\/releases\/([0-9a-f]{64})\/search\.json$/;

export type EventSearchRequest = {
	kind: "search";
	requestId: number;
	indexUrl: string;
	preferences: RecommendationPreferences;
	offset: number;
	limit: number;
};

export type EventSearchResult = {
	kind: "result";
	requestId: number;
	offset: number;
	events: RankedEvent[];
	periodFallback: boolean;
	totalCount: number;
};

export type EventSearchFailure = {
	kind: "error";
	requestId: number;
	message: string;
};

export function createEventSearchRuntime(
	loadArtifact: (url: string) => Promise<unknown> = loadEventSearchArtifact,
) {
	const indexes = new Map<string, Promise<RecommendationEngine>>();

	function getIndex(indexUrl: string): Promise<RecommendationEngine> {
		const expectedReleaseId = parseReleaseId(indexUrl);
		let pending = indexes.get(indexUrl);
		if (!pending) {
			pending = loadArtifact(indexUrl).then((value) =>
				createRecommendationEngine(
					hydrateEventSearchEntries(
						parseEventSearchArtifact(value, { expectedReleaseId }),
					),
				),
			);
			indexes.set(indexUrl, pending);
			pending.catch(() => indexes.delete(indexUrl));
		}
		return pending;
	}

	return {
		preload: async (indexUrl: string) => {
			await getIndex(indexUrl);
		},
		search: async (request: EventSearchRequest): Promise<EventSearchResult> => {
			if (!Number.isSafeInteger(request.requestId) || request.requestId < 0) {
				throw new Error("Search request ID must be a non-negative integer");
			}
			const engine = await getIndex(request.indexUrl);
			const page = engine.page(request.preferences, {
				offset: request.offset,
				limit: request.limit,
			});
			return {
				kind: "result",
				requestId: request.requestId,
				offset: request.offset,
				...page,
			};
		},
	};
}

export async function loadEventSearchArtifact(
	indexUrl: string,
): Promise<unknown> {
	parseReleaseId(indexUrl);
	const target = new URL(indexUrl, globalThis.location?.origin);
	if (globalThis.location && target.origin !== globalThis.location.origin) {
		throw new Error("Search index must use the current origin");
	}
	const response = await fetch(target, {
		credentials: "same-origin",
		headers: { Accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`Search index request failed with ${response.status}`);
	}
	const declaredLength = Number(response.headers.get("content-length"));
	if (
		Number.isFinite(declaredLength) &&
		declaredLength > EVENT_SEARCH_MAX_BYTES
	) {
		throw new Error("Search index exceeds byte limit");
	}
	const bytes = await response.arrayBuffer();
	if (bytes.byteLength > EVENT_SEARCH_MAX_BYTES) {
		throw new Error("Search index exceeds byte limit");
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}

function parseReleaseId(indexUrl: string): string {
	if (!indexUrl.startsWith("/") || indexUrl.startsWith("//")) {
		throw new Error("Search index URL must be same-origin relative");
	}
	const parsed = new URL(indexUrl, "https://search.invalid");
	const match = releaseSearchPathPattern.exec(parsed.pathname);
	if (!match || parsed.search || parsed.hash) {
		throw new Error("Search index URL must be a release-qualified static path");
	}
	return match[1];
}
