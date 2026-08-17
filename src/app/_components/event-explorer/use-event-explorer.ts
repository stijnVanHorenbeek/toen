"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventExplorerBootstrap } from "@/lib/content/event-explorer-data";
import type {
	EventSearchFailure,
	EventSearchResult,
} from "@/lib/content/event-search-runtime";
import type {
	RecommendationPage,
	RecommendationPreferences,
} from "@/lib/content/recommend-events";
import { createSearchRequestSequence } from "@/lib/content/search-request-sequence";
import type { EventSearchWorkerRequest } from "./event-search.worker";

const pageSize = 24;
const queryDebounceMs = 180;

export type EventExplorerValue = {
	state: RecommendationPreferences;
	actions: {
		update: <Key extends keyof RecommendationPreferences>(
			field: Key,
			value: RecommendationPreferences[Key],
		) => void;
		toggleTopic: (topic: string) => void;
		showAll: () => void;
		nextPage: () => void;
		previousPage: () => void;
		retry: () => void;
	};
	meta: {
		catalogSize: number;
		topicLabels: Record<string, string>;
		topicOptions: string[];
		recommendations: RecommendationPage;
		offset: number;
		pageSize: number;
		isInitialPage: boolean;
		loading: boolean;
		error: string | null;
	};
};

export function useEventExplorerValue(
	bootstrap: EventExplorerBootstrap,
): EventExplorerValue {
	const [state, setState] = useState<RecommendationPreferences>(() => ({
		selectedDate: "",
		yearMin: bootstrap.yearRange.min,
		yearMax: bootstrap.yearRange.max,
		topics: [],
		query: "",
	}));
	const [recommendations, setRecommendations] = useState(
		bootstrap.initialRecommendations,
	);
	const [offset, setOffset] = useState(0);
	const [isInitialPage, setIsInitialPage] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [interactionGeneration, setInteractionGeneration] = useState(0);
	const [requestSequence] = useState(createSearchRequestSequence);
	const workerRef = useRef<Worker | null>(null);
	const currentOffsetRef = useRef(0);
	const stateRef = useRef(state);
	stateRef.current = state;

	const handleWorkerMessage = useCallback(
		(event: MessageEvent<EventSearchResult | EventSearchFailure>) => {
			const response = event.data;
			if (!requestSequence.isCurrent(response.requestId)) return;
			setLoading(false);
			if (response.kind === "error") {
				setError(response.message);
				return;
			}
			setError(null);
			setOffset(response.offset);
			currentOffsetRef.current = response.offset;
			setIsInitialPage(false);
			setRecommendations({
				events: response.events,
				periodFallback: response.periodFallback,
				totalCount: response.totalCount,
			});
		},
		[requestSequence],
	);

	const getWorker = useCallback(() => {
		if (workerRef.current) return workerRef.current;
		const worker = new Worker(bootstrap.workerUrl, { type: "module" });
		worker.onmessage = handleWorkerMessage;
		worker.onerror = () => {
			setLoading(false);
			setError("Browser Worker failed");
		};
		worker.onmessageerror = () => {
			setLoading(false);
			setError("Browser Worker response was invalid");
		};
		workerRef.current = worker;
		return worker;
	}, [bootstrap.workerUrl, handleWorkerMessage]);

	const search = useCallback(
		(requestedOffset: number) => {
			const requestId = requestSequence.next();
			setLoading(true);
			setError(null);
			const preferences = stateRef.current;
			const request: EventSearchWorkerRequest = {
				kind: "search",
				requestId,
				indexUrl: bootstrap.searchIndexUrl,
				preferences: {
					...preferences,
					selectedDate: preferences.selectedDate || "2000-01-03",
				},
				offset: requestedOffset,
				limit: pageSize,
			};
			getWorker().postMessage(request);
		},
		[bootstrap.searchIndexUrl, getWorker, requestSequence],
	);

	useEffect(() => {
		const connection = (
			navigator as Navigator & { connection?: { saveData?: boolean } }
		).connection;
		if (connection?.saveData) return;
		const preload = () =>
			getWorker().postMessage({
				kind: "preload",
				indexUrl: bootstrap.searchIndexUrl,
			} satisfies EventSearchWorkerRequest);
		if ("requestIdleCallback" in window) {
			const idleId = window.requestIdleCallback(preload, { timeout: 2_000 });
			return () => window.cancelIdleCallback(idleId);
		}
		const timeoutId = setTimeout(preload, 1_000);
		return () => clearTimeout(timeoutId);
	}, [bootstrap.searchIndexUrl, getWorker]);

	useEffect(
		() => () => {
			workerRef.current?.terminate();
			workerRef.current = null;
		},
		[],
	);

	useEffect(() => {
		if (interactionGeneration === 0) return;
		const timeoutId = window.setTimeout(() => search(0), queryDebounceMs);
		return () => window.clearTimeout(timeoutId);
	}, [interactionGeneration, search]);

	function markFiltersChanged() {
		requestSequence.invalidate();
		currentOffsetRef.current = 0;
		setLoading(true);
		setError(null);
		setInteractionGeneration((generation) => generation + 1);
	}

	function update<Key extends keyof RecommendationPreferences>(
		field: Key,
		value: RecommendationPreferences[Key],
	) {
		setState((current) => ({ ...current, [field]: value }));
		markFiltersChanged();
	}

	function toggleTopic(topic: string) {
		setState((current) => ({
			...current,
			topics: current.topics.includes(topic)
				? current.topics.filter((value) => value !== topic)
				: [...current.topics, topic],
		}));
		markFiltersChanged();
	}

	return {
		state,
		actions: {
			update,
			toggleTopic,
			showAll: () => search(0),
			nextPage: () => search(currentOffsetRef.current + pageSize),
			previousPage: () =>
				search(Math.max(0, currentOffsetRef.current - pageSize)),
			retry: () => search(currentOffsetRef.current),
		},
		meta: {
			catalogSize: bootstrap.catalogSize,
			topicLabels: bootstrap.topicLabels,
			topicOptions: bootstrap.topicOptions,
			recommendations,
			offset,
			pageSize,
			isInitialPage,
			loading,
			error,
		},
	};
}
