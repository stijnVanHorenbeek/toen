import Link from "next/link";
import { formatHistoricalDate } from "@/lib/content/event";
import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import type {
	RankedEvent,
	RecommendationPreferences,
} from "@/lib/content/recommend-events";
import { formatEventTag, formatNumber } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";

export function EventCard({
	recommendation,
	preferences,
}: {
	recommendation: RankedEvent;
	preferences: RecommendationPreferences;
}) {
	const { event } = recommendation;
	const fitLabels = getFitLabels(event, preferences);

	return (
		<article className="py-6 sm:py-7">
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
								{messages.home.duration}: {event.activity.durations.join(", ")}{" "}
								minuten
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
			<h3 className="mt-3 text-balance font-serif text-3xl font-medium leading-[1.02] tracking-[-0.025em] sm:text-4xl">
				{event.title}
			</h3>
			<p className="mt-3 max-w-3xl text-pretty text-base leading-6 text-ink/70">
				{event.activity?.question ?? event.summary}
			</p>
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
			<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
				{event.activity ? (
					<>
						<Link
							href={`/events/${event.slug}/play`}
							className="primary-button inline-flex items-center"
						>
							{messages.home.startActivity}
						</Link>
						<Link
							href={`/events/${event.slug}`}
							className="text-button inline-flex items-center"
						>
							{messages.home.readBackground}
						</Link>
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
