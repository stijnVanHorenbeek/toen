"use client";

import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import { formatNumber } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { EventCard } from "./event-card";
import { useEventExplorer } from "./event-explorer-context";

export function RecommendationResults() {
	const { meta } = useEventExplorer();
	const { events, periodFallback } = meta.recommendations;

	return (
		<>
			{periodFallback ? <PeriodFallback /> : null}
			<RecommendationHeader count={events.length} />
			<EventList events={events.map(({ event }) => event)} />
		</>
	);
}

function PeriodFallback() {
	return (
		<p
			role="status"
			className="mt-6 border-accent border-l-2 py-1 pl-4 text-sm text-ink/65"
		>
			<strong className="text-ink">{messages.home.noPeriodEvent}</strong>{" "}
			{messages.home.periodFallback}
		</p>
	);
}

function RecommendationHeader({ count }: { count: number }) {
	return (
		<div className="mt-10 flex items-end justify-between gap-6">
			<h2 className="font-serif text-3xl font-semibold tracking-tight">
				{messages.home.recommended}
			</h2>
			<p className="font-mono text-ink/45 text-xs uppercase tracking-widest">
				{formatNumber(count)}{" "}
				{count === 1 ? messages.home.story : messages.home.stories}
			</p>
		</div>
	);
}

function EventList({ events }: { events: EventCatalogEntry[] }) {
	return (
		<ul className="mt-8 divide-y divide-ink/15 border-ink/15 border-y">
			{events.map((event) => (
				<li key={event.slug} data-recommended-event>
					<EventCard event={event} />
				</li>
			))}
		</ul>
	);
}
