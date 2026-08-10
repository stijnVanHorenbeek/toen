"use client";

import type { EventCatalogEntry } from "@/lib/content/event-catalog";
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
		<p className="mt-6 border-accent border-l-2 py-1 pl-4 text-sm text-ink/65">
			<strong className="text-ink">Geen gebeurtenis in deze periode.</strong>{" "}
			Daarom tonen we de beste gebeurtenissen buiten de gekozen jaren.
		</p>
	);
}

function RecommendationHeader({ count }: { count: number }) {
	return (
		<div className="mt-10 flex items-end justify-between gap-6">
			<h2 className="font-serif text-3xl font-semibold tracking-tight">
				Aanbevolen
			</h2>
			<p className="font-mono text-ink/45 text-xs uppercase tracking-widest">
				{count} {count === 1 ? "verhaal" : "verhalen"}
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
