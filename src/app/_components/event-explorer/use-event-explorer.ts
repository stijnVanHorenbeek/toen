"use client";

import { useMemo, useState } from "react";
import {
	collectTopicLabels,
	type EventCatalogEntry,
} from "@/lib/content/event-catalog";
import {
	type RecommendationPreferences,
	type RecommendationResult,
	recommendEvents,
} from "@/lib/content/recommend-events";
import { compareLocalized } from "@/lib/i18n/locale";

export type EventExplorerValue = {
	state: RecommendationPreferences;
	actions: {
		update: <Key extends keyof RecommendationPreferences>(
			field: Key,
			value: RecommendationPreferences[Key],
		) => void;
		toggleTopic: (topic: string) => void;
	};
	meta: {
		catalogSize: number;
		topicLabels: Record<string, string>;
		topicOptions: string[];
		recommendations: RecommendationResult;
	};
};

export function useEventExplorerValue(
	events: EventCatalogEntry[],
): EventExplorerValue {
	const [state, setState] = useState<RecommendationPreferences>(() => {
		const yearRange = getYearRange(events);
		return {
			selectedDate: "",
			yearMin: yearRange.min,
			yearMax: yearRange.max,
			topics: [],
			query: "",
		};
	});

	const topicOptions = useMemo(
		() => collectTags(events.flatMap((event) => event.topics)),
		[events],
	);
	const topicLabels = useMemo(() => collectTopicLabels(events), [events]);
	const recommendations = useMemo(
		() =>
			recommendEvents(events, {
				...state,
				selectedDate: state.selectedDate || "2000-01-03",
			}),
		[events, state],
	);

	function update<Key extends keyof RecommendationPreferences>(
		field: Key,
		value: RecommendationPreferences[Key],
	) {
		setState((current) => ({ ...current, [field]: value }));
	}

	function toggleTopic(topic: string) {
		setState((current) => ({
			...current,
			topics: current.topics.includes(topic)
				? current.topics.filter((value) => value !== topic)
				: [...current.topics, topic],
		}));
	}

	return {
		state,
		actions: { update, toggleTopic },
		meta: {
			catalogSize: events.length,
			topicLabels,
			topicOptions,
			recommendations,
		},
	};
}

function getYearRange(events: EventCatalogEntry[]) {
	if (events.length === 0) return { min: -3000, max: 2100 };

	const years = events.map(({ date }) =>
		date.era === "bce" ? -date.year : date.year,
	);
	return {
		min: Math.min(...years),
		max: Math.max(...years),
	};
}

function collectTags<Value extends string>(values: Value[]): Value[] {
	return [...new Set(values)].sort(compareLocalized);
}
