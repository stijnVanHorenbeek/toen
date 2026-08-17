import ReactMarkdown from "react-markdown";
import { formatHistoricalDate } from "@/lib/content/event";
import type { Event } from "@/lib/content/event-document";
import { getEventVisual } from "@/lib/content/event-media";
import { formatEventTag, formatNumber } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { HistoricalVisualFigure } from "./historical-visual";

type EventArticleProps = {
	event: Event;
	variant: "page" | "preview";
};

export function EventArticle({ event, variant }: EventArticleProps) {
	const page = variant === "page";
	const Title = page ? "h1" : "h2";
	const SourceHeading = page ? "h2" : "h3";
	const visual = getEventVisual(event.slug);
	return (
		<article
			className={
				page
					? ""
					: "overflow-hidden rounded-md border border-ink/25 bg-paper shadow-[0_18px_70px_rgb(33_31_26_/_10%)]"
			}
		>
			<header
				className={
					page
						? "border-ink/15 border-b pb-12 lg:pb-16"
						: "border-ink/15 border-b px-6 py-9 sm:px-10 sm:py-12"
				}
			>
				<p className="font-semibold text-accent text-sm uppercase tracking-[0.18em]">
					{formatHistoricalDate(event.date)}
				</p>
				<Title
					className={
						page
							? "mt-5 max-w-4xl text-balance font-serif text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl"
							: "mt-4 max-w-3xl text-balance font-serif text-4xl font-medium leading-[1] tracking-[-0.04em] sm:text-6xl"
					}
				>
					{event.title}
				</Title>
				<p
					className={
						page
							? "mt-7 max-w-2xl text-pretty text-lg leading-8 text-ink/65"
							: "mt-5 max-w-2xl text-pretty text-base leading-7 text-ink/75 sm:text-lg"
					}
				>
					{event.summary}
				</p>
				<ul
					aria-label={messages.event.topics}
					className="mt-6 flex flex-wrap gap-2"
				>
					{event.topics.map((topic) => (
						<li
							key={topic}
							className="rounded-full border border-ink/25 px-3 py-1 text-sm"
						>
							{event.topicLabels?.[topic] ?? formatEventTag(topic)}
						</li>
					))}
				</ul>
				{page && event.beat ? (
					<div
						data-article-activity-introduction
						className="mt-8 max-w-2xl border-accent border-l-2 pl-4"
					>
						<p className="font-bold text-accent text-xs uppercase tracking-[0.16em]">
							{messages.home.activity}
						</p>
						<p
							data-activity-question
							className="mt-2 text-pretty font-serif text-xl font-medium leading-tight"
						>
							{event.beat.question}
						</p>
						<p className="mt-2 text-ink/65 text-sm">
							{messages.home.mechanics[event.beat.mechanic]} ·{" "}
							{event.beat.routes
								.map(({ durationMinutes }) => formatNumber(durationMinutes))
								.join(" · ")}{" "}
							{messages.home.minuteAbbreviation}
						</p>
					</div>
				) : null}
			</header>
			{visual ? (
				<HistoricalVisualFigure
					visual={visual}
					className={
						page
							? "mt-10 overflow-hidden rounded-md bg-ink text-paper shadow-[0_28px_90px_rgb(33_31_26_/_18%)] [&_figcaption]:px-3 [&_figcaption]:py-2 sm:mt-14 sm:[&_figcaption]:px-5 sm:[&_figcaption]:py-4"
							: "bg-ink text-paper [&_figcaption]:px-5 [&_figcaption]:py-4 sm:[&_figcaption]:px-10"
					}
					imageClassName={
						page
							? "aspect-[16/9] w-full object-cover"
							: "aspect-[16/8] w-full object-cover"
					}
				/>
			) : null}
			<div
				className={
					page
						? "grid gap-14 pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:pt-16"
						: "grid gap-10 px-6 py-9 sm:px-10 lg:grid-cols-[minmax(0,1fr)_14rem]"
				}
			>
				<div className="prose-event min-w-0 max-w-2xl">
					<ReactMarkdown>{event.body}</ReactMarkdown>
				</div>
				<aside className="min-w-0 border-ink/15 border-t pt-5 lg:border-t-0 lg:border-l lg:pl-7 lg:pt-0">
					<SourceHeading className="font-semibold text-xs uppercase tracking-[0.2em]">
						{messages.event.sources}
					</SourceHeading>
					<ul className="mt-5 space-y-5">
						{event.sources.map((source) => (
							<li key={source.url} className="min-w-0">
								<a
									href={source.url}
									target="_blank"
									rel="noreferrer"
									className="block max-w-full break-words font-serif text-lg decoration-accent/50 underline underline-offset-4 hover:text-accent"
								>
									{source.title}
								</a>
								<p className="mt-1 break-words text-ink/70 text-sm leading-5">
									{source.publisher}
								</p>
							</li>
						))}
					</ul>
				</aside>
			</div>
			{page && event.beat ? (
				<section
					data-article-activity-continuation
					className="mt-14 border-ink/15 border-t pt-10 sm:mt-16"
				>
					<h2 className="text-balance font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
						{messages.event.continueWithActivity}
					</h2>
					<p className="mt-3 max-w-2xl text-pretty text-ink/65 leading-7">
						{event.beat.question}
					</p>
					<a
						href={`/events/${event.slug}/play`}
						className="primary-button mt-6 inline-flex items-center"
					>
						{messages.home.startActivity}
					</a>
				</section>
			) : null}
		</article>
	);
}
