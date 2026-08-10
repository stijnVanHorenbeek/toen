import Link from "next/link";
import { formatHistoricalDate } from "@/lib/content/event";
import type { EventCatalogEntry } from "@/lib/content/event-catalog";
import { formatEventTag } from "./event-labels";

export function EventCard({ event }: { event: EventCatalogEntry }) {
	return (
		<article className="grid gap-5 py-8 sm:grid-cols-[11rem_1fr] sm:py-10">
			<div>
				<p className="font-semibold text-accent text-sm uppercase tracking-[0.15em]">
					{formatHistoricalDate(event.date)}
				</p>
				<EventTopics topics={event.topics} />
			</div>
			<div className="max-w-3xl">
				<h3 className="font-serif text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
					<Link
						href={`/events/${event.slug}`}
						className="decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:underline focus-visible:text-accent"
					>
						{event.title}
					</Link>
				</h3>
				<p className="mt-4 max-w-2xl text-base leading-7 text-ink/65">
					{event.summary}
				</p>
			</div>
		</article>
	);
}

function EventTopics({ topics }: { topics: string[] }) {
	return (
		<ul className="mt-3 flex flex-wrap gap-2">
			{topics.map((topic) => (
				<li
					key={topic}
					className="rounded-full border border-ink/20 px-2.5 py-1 text-[0.65rem] text-ink/55 uppercase tracking-wider"
				>
					{formatEventTag(topic)}
				</li>
			))}
		</ul>
	);
}
