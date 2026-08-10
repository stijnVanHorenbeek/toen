"use client";

import { createContext, type ReactNode, use } from "react";
import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import {
	type EventExplorerValue,
	useEventExplorerValue,
} from "./use-event-explorer";

const EventExplorerContext = createContext<EventExplorerValue | null>(null);

export function EventExplorerProvider({
	children,
	events,
}: {
	children: ReactNode;
	events: EventCatalogEntry[];
}) {
	const value = useEventExplorerValue(events);
	return <EventExplorerContext value={value}>{children}</EventExplorerContext>;
}

export function useEventExplorer(): EventExplorerValue {
	const context = use(EventExplorerContext);
	if (!context) {
		throw new Error(
			"useEventExplorer must be used within EventExplorerProvider",
		);
	}
	return context;
}
