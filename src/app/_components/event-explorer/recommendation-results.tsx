"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getRecommendationPagination } from "@/lib/content/recommendation-pagination";
import { formatNumber } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { EventCard } from "./event-card";
import { useEventExplorer } from "./event-explorer-context";

export function RecommendationResults({ filters }: { filters: ReactNode }) {
	const { state, actions, meta } = useEventExplorer();
	const { events, periodFallback, totalCount } = meta.recommendations;
	const [focusAfterLoad, setFocusAfterLoad] = useState(false);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const [first, ...remaining] = events;
	const { pageNumber, pageCount, hasPrevious, hasNext, showNavigation } =
		getRecommendationPagination({
			eventCount: events.length,
			isInitialPage: meta.isInitialPage,
			offset: meta.offset,
			pageSize: meta.pageSize,
			totalCount,
		});
	const canExpandInitial =
		meta.isInitialPage && totalCount > events.length && !meta.loading;

	useEffect(() => {
		if (!focusAfterLoad || meta.loading || meta.error) return;
		headingRef.current?.focus();
		setFocusAfterLoad(false);
	}, [focusAfterLoad, meta.error, meta.loading]);

	if (meta.catalogSize === 0) return <EmptyCatalog />;

	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-12">
			<aside className="row-start-1 lg:col-start-2 lg:row-span-3">
				{filters}
			</aside>
			<section
				aria-labelledby="recommendations-title"
				aria-busy={meta.loading}
				className="min-w-0 lg:col-start-1 lg:row-start-1"
			>
				<RecommendationHeader
					headingRef={headingRef}
					count={events.length}
					totalCount={totalCount}
				/>
				{meta.loading ? (
					<p role="status" className="mt-3 text-ink/65 text-sm">
						{messages.home.loadingResults}
					</p>
				) : null}
				{meta.error ? <SearchFailure retry={actions.retry} /> : null}
				{periodFallback ? <PeriodFallback /> : null}
				{first ? (
					<ul className="mt-4 border-ink/15 border-y">
						<li data-recommended-event data-featured-recommendation>
							<EventCard recommendation={first} preferences={state} />
						</li>
					</ul>
				) : (
					<NoMatches />
				)}
			</section>
			{remaining.length > 0 || canExpandInitial || showNavigation ? (
				<section
					aria-label={messages.home.moreRecommendations}
					className="min-w-0 lg:col-start-1"
				>
					{remaining.length > 0 ? (
						<ul
							id="additional-recommendations"
							className="divide-y divide-ink/15 border-ink/15 border-b"
						>
							{remaining.map((recommendation) => (
								<li
									key={recommendation.event.slug}
									data-recommended-event
									data-compact-recommendation
								>
									<EventCard
										recommendation={recommendation}
										preferences={state}
										variant="compact"
									/>
								</li>
							))}
						</ul>
					) : null}
					{canExpandInitial ? (
						<button
							type="button"
							aria-controls="additional-recommendations"
							onClick={() => {
								setFocusAfterLoad(true);
								actions.showAll();
							}}
							className="secondary-button mt-6 inline-flex items-center"
						>
							{messages.home.showAll} {formatNumber(totalCount)}{" "}
							{messages.home.results}
						</button>
					) : null}
					{showNavigation ? (
						<nav
							aria-label={messages.home.moreRecommendations}
							className="mt-6 flex flex-wrap items-center gap-3"
						>
							<button
								type="button"
								disabled={!hasPrevious || meta.loading}
								onClick={() => {
									setFocusAfterLoad(true);
									actions.previousPage();
								}}
								className="secondary-button"
							>
								{messages.home.previousResults}
							</button>
							<p className="font-mono text-ink/55 text-xs uppercase tracking-widest">
								{messages.home.page} {formatNumber(pageNumber)} /{" "}
								{formatNumber(pageCount)}
							</p>
							<button
								type="button"
								disabled={!hasNext || meta.loading}
								onClick={() => {
									setFocusAfterLoad(true);
									actions.nextPage();
								}}
								className="secondary-button"
							>
								{messages.home.nextResults}
							</button>
						</nav>
					) : null}
				</section>
			) : null}
		</div>
	);
}

function SearchFailure({ retry }: { retry: () => void }) {
	return (
		<div role="alert" className="mt-4 border-accent border-l-2 py-1 pl-4">
			<p className="text-sm">{messages.home.searchUnavailable}</p>
			<button type="button" onClick={retry} className="text-button mt-2">
				{messages.home.retrySearch}
			</button>
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
	headingRef,
	totalCount,
}: {
	count: number;
	headingRef: React.RefObject<HTMLHeadingElement | null>;
	totalCount: number;
}) {
	const countLabel =
		totalCount > count
			? `${formatNumber(count)} van ${formatNumber(totalCount)} ${messages.home.results} ${messages.home.showing}`
			: `${formatNumber(count)} ${count === 1 ? messages.home.result : messages.home.results}`;

	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<h1
				ref={headingRef}
				tabIndex={-1}
				id="recommendations-title"
				className="font-serif text-3xl font-semibold tracking-tight focus:outline-none"
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
			<h2 className="font-serif text-2xl font-semibold">
				{messages.home.noMatchesTitle}
			</h2>
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
