"use client";

import { createContext, type ReactNode, use } from "react";
import type { EventExplorerBootstrap } from "@/lib/content/event-explorer-data";
import {
	type EventExplorerValue,
	useEventExplorerValue,
} from "./use-event-explorer";

const EventExplorerContext = createContext<EventExplorerValue | null>(null);

export function EventExplorerProvider({
	bootstrap,
	children,
}: {
	bootstrap: EventExplorerBootstrap;
	children: ReactNode;
}) {
	const value = useEventExplorerValue(bootstrap);
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
