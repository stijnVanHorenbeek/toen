"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { formatNumber } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { EventCard } from "./event-card";
import { useEventExplorer } from "./event-explorer-context";

export function RecommendationResults({ filters }: { filters: ReactNode }) {
	const { state, meta } = useEventExplorer();
	const { events, additionalEvents, periodFallback, totalCount } =
		meta.recommendations;
	const [expanded, setExpanded] = useState(false);

	if (meta.catalogSize === 0) return <EmptyCatalog />;

	const displayedEvents = expanded ? [...events, ...additionalEvents] : events;
	const [first, ...remaining] = displayedEvents;
	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-12">
			<section
				aria-labelledby="recommendations-title"
				className="min-w-0 lg:col-start-1 lg:row-start-1"
			>
				<RecommendationHeader
					count={displayedEvents.length}
					totalCount={totalCount}
				/>
				{periodFallback ? <PeriodFallback /> : null}
				{first ? (
					<ul className="mt-4 border-ink/15 border-y">
						<li data-recommended-event>
							<EventCard recommendation={first} preferences={state} />
						</li>
					</ul>
				) : (
					<NoMatches />
				)}
			</section>
			<aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
				{filters}
			</aside>
			{remaining.length > 0 ? (
				<section
					aria-label={messages.home.moreRecommendations}
					className="min-w-0 lg:col-start-1"
				>
					<ul
						id="additional-recommendations"
						className="divide-y divide-ink/15 border-ink/15 border-b"
					>
						{remaining.map((recommendation) => (
							<li key={recommendation.event.slug} data-recommended-event>
								<EventCard
									recommendation={recommendation}
									preferences={state}
								/>
							</li>
						))}
					</ul>
					{additionalEvents.length > 0 ? (
						<button
							type="button"
							aria-controls="additional-recommendations"
							aria-expanded={expanded}
							onClick={() => setExpanded((current) => !current)}
							className="secondary-button mt-6 inline-flex items-center"
						>
							{expanded
								? messages.home.showLess
								: `${messages.home.showAll} ${formatNumber(totalCount)} ${messages.home.results}`}
						</button>
					) : null}
				</section>
			) : null}
		</div>
	);
}

function PeriodFallback() {
	return (
		<p
			role="status"
			className="mt-4 border-accent border-l-2 py-1 pl-4 text-sm text-ink/65"
		>
			<strong className="text-ink">{messages.home.noPeriodEvent}</strong>{" "}
			{messages.home.periodFallback}
		</p>
	);
}

function RecommendationHeader({
	count,
	totalCount,
}: {
	count: number;
	totalCount: number;
}) {
	const countLabel =
		totalCount > count
			? `${formatNumber(count)} van ${formatNumber(totalCount)} ${messages.home.results} ${messages.home.showing}`
			: `${formatNumber(count)} ${count === 1 ? messages.home.result : messages.home.results}`;

	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<h1
				id="recommendations-title"
				className="font-serif text-3xl font-semibold tracking-tight"
			>
				{messages.home.recommended}
			</h1>
			<p
				aria-live="polite"
				className="font-mono text-ink/50 text-xs uppercase tracking-widest"
			>
				{countLabel}
			</p>
		</header>
	);
}

function NoMatches() {
	return (
		<div role="status" className="mt-5 border-ink/15 border-y py-7">
			<h3 className="font-serif text-2xl font-semibold">
				{messages.home.noMatchesTitle}
			</h3>
			<p className="mt-2 max-w-xl text-ink/65 leading-6">
				{messages.home.noMatches}
			</p>
		</div>
	);
}

function EmptyCatalog() {
	return (
		<section
			role="status"
			className="rounded-md border border-ink/20 bg-white/35 px-6 py-8 sm:px-8"
		>
			<h2 className="font-serif text-3xl font-semibold">
				{messages.home.emptyCatalogTitle}
			</h2>
			<p className="mt-3 max-w-xl text-ink/65 leading-7">
				{messages.home.emptyCatalog}
			</p>
			<Link
				href="/admin"
				className="primary-button mt-6 inline-flex items-center"
			>
				{messages.home.createActivity}
			</Link>
		</section>
	);
}
