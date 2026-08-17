import type { ComponentPropsWithoutRef } from "react";
import { HistoricalVisualFigure } from "@/app/_components/historical-visual";
import { formatHistoricalDate } from "@/lib/content/event";
import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import { getEventVisual } from "@/lib/content/event-media";
import type {
	RankedEvent,
	RecommendationPreferences,
} from "@/lib/content/recommend-events";
import { formatEventTag, formatNumber } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";

export function EventCard({
	recommendation,
	preferences,
	variant = "featured",
}: {
	recommendation: RankedEvent;
	preferences: RecommendationPreferences;
	variant?: "featured" | "compact";
}) {
	const { event } = recommendation;
	const fitLabels = getFitLabels(event, preferences);
	const visual = getEventVisual(event.slug);

	const compact = variant === "compact";
	return (
		<article
			className={
				compact
					? "grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
					: "py-6 sm:py-7"
			}
		>
			{visual && !compact ? (
				<HistoricalVisualFigure
					visual={visual}
					className="mb-6 overflow-hidden rounded-md bg-ink text-paper shadow-[0_18px_50px_rgb(33_31_26_/_14%)] [&_figcaption]:px-4 [&_figcaption]:py-3"
					imageClassName="aspect-[16/6.5] max-h-52 w-full object-cover grayscale-[15%]"
				/>
			) : null}
			<div className={compact ? "min-w-0" : undefined}>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<p className="font-semibold text-accent text-xs uppercase tracking-[0.14em]">
						{formatHistoricalDate(event.date)}
					</p>
					{event.activity ? (
						<>
							<p className="font-bold text-ink/60 text-xs uppercase tracking-[0.12em]">
								{messages.home.mechanics[event.activity.mechanic]}
							</p>
							<p className="font-bold text-ink/60 text-xs">
								<span className="sr-only">
									{messages.home.duration}:{" "}
									{event.activity.durations.join(", ")} minuten
								</span>
								<span aria-hidden="true">
									{event.activity.durations.map(formatNumber).join(" · ")} min
								</span>
							</p>
						</>
					) : (
						<p className="font-bold text-ink/60 text-xs uppercase tracking-[0.12em]">
							{messages.home.articleOnly}
						</p>
					)}
				</div>
				<h2
					className={
						compact
							? "mt-2 text-balance font-serif text-2xl font-medium leading-tight tracking-[-0.02em]"
							: "mt-3 text-balance font-serif text-3xl font-medium leading-[1.02] tracking-[-0.025em] sm:text-4xl"
					}
				>
					{compact ? (
						<Link
							href={`/events/${event.slug}`}
							className="inline-flex min-h-11 items-center decoration-accent/50 underline-offset-4 hover:text-accent hover:underline"
						>
							{event.title}
						</Link>
					) : (
						event.title
					)}
				</h2>
				{compact ? null : (
					<p className="mt-3 max-w-3xl text-pretty text-base leading-6 text-ink/70">
						{event.activity?.question ?? event.summary}
					</p>
				)}
				{fitLabels.length > 0 ? (
					<ul
						aria-label={messages.home.whyFit}
						className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-ink/55 text-xs"
					>
						{fitLabels.map((label) => (
							<li key={label}>{label}</li>
						))}
					</ul>
				) : null}
			</div>
			<div
				className={
					compact
						? "flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end"
						: "mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"
				}
			>
				{event.activity ? (
					<>
						<Link
							href={`/events/${event.slug}/play`}
							className={`${compact ? "text-button" : "primary-button"} inline-flex items-center`}
						>
							{messages.home.startActivity}
						</Link>
						{compact ? null : (
							<Link
								href={`/events/${event.slug}`}
								className="text-button inline-flex items-center"
							>
								{messages.home.readBackground}
							</Link>
						)}
					</>
				) : (
					<Link
						href={`/events/${event.slug}`}
						className="secondary-button inline-flex items-center"
					>
						{messages.home.readStory}
					</Link>
				)}
			</div>
		</article>
	);
}

function Link({
	href,
	...props
}: { href: string } & Omit<ComponentPropsWithoutRef<"a">, "href">) {
	return <a href={href} {...props} />;
}

function getFitLabels(
	event: EventCatalogEntry,
	preferences: RecommendationPreferences,
): string[] {
	const labels: string[] = [];
	if (preferences.query.trim()) labels.push(messages.home.fitSearch);
	for (const topic of preferences.topics) {
		if (!event.topics.includes(topic)) continue;
		labels.push(
			`${messages.home.fitTopic}: ${event.topicLabels?.[topic] ?? formatEventTag(topic)}`,
		);
	}
	return labels;
}
