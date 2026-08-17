/// <reference lib="webworker" />

import {
	createEventSearchRuntime,
	type EventSearchFailure,
	type EventSearchRequest,
} from "@/lib/content/event-search-runtime";

export type EventSearchWorkerRequest =
	| { kind: "preload"; indexUrl: string }
	| EventSearchRequest;

const runtime = createEventSearchRuntime();
const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (
	event: MessageEvent<EventSearchWorkerRequest>,
) => {
	const request = event.data;
	if (request.kind === "preload") {
		await runtime.preload(request.indexUrl).catch(() => undefined);
		return;
	}
	try {
		workerScope.postMessage(await runtime.search(request));
	} catch (error) {
		const response: EventSearchFailure = {
			kind: "error",
			requestId: request.requestId,
			message: error instanceof Error ? error.message : "Search worker failed",
		};
		workerScope.postMessage(response);
	}
};
