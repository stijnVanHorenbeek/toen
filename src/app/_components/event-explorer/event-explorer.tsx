"use client";

import type { EventExplorerBootstrap } from "@/lib/content/event-explorer-data";
import { EventExplorerProvider } from "./event-explorer-context";
import { EventFilters } from "./event-filters";
import { RecommendationResults } from "./recommendation-results";

export function EventExplorer({
	bootstrap,
}: {
	bootstrap: EventExplorerBootstrap;
}) {
	return (
		<EventExplorerProvider bootstrap={bootstrap}>
			<RecommendationResults filters={<EventFilters />} />
		</EventExplorerProvider>
	);
}
