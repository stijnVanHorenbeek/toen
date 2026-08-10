"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import {
	type RecommendationPreferences,
	type RecommendationResult,
	recommendEvents,
} from "@/lib/content/recommend-events";

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
		profileOptions: string[];
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
			profile: "algemeen",
			topics: [],
		};
	});

	useEffect(() => {
		setState((current) => ({
			...current,
			selectedDate: getLocalISODate(),
		}));
	}, []);

	const profileOptions = useMemo(
		() => collectTags(events.flatMap((event) => event.profiles)),
		[events],
	);
	const topicOptions = useMemo(
		() => collectTags(events.flatMap((event) => event.topics)),
		[events],
	);
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
		meta: { profileOptions, topicOptions, recommendations },
	};
}

function getYearRange(events: EventCatalogEntry[]) {
	const years = events.map(({ date }) =>
		date.era === "bce" ? -date.year : date.year,
	);
	return {
		min: Math.min(...years),
		max: Math.max(...years),
	};
}

function collectTags(values: string[]): string[] {
	return [...new Set(values)].sort();
}

function getLocalISODate(): string {
	const date = new Date();
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
