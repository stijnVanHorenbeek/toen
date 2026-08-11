"use client";

import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import { EventExplorerProvider } from "./event-explorer-context";
import { EventFilters } from "./event-filters";
import { RecommendationResults } from "./recommendation-results";

export function EventExplorer({ events }: { events: EventCatalogEntry[] }) {
	return (
		<EventExplorerProvider events={events}>
			<RecommendationResults filters={<EventFilters />} />
		</EventExplorerProvider>
	);
}
