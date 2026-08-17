import Link from "next/link";
import { formatHistoricalDate } from "@/lib/content/event";
import type { EventCatalogEntry } from "@/lib/content/event-catalog";

export function EventArchiveList({ events }: { events: EventCatalogEntry[] }) {
	return (
		<ul className="mt-6 divide-y divide-ink/15 border-ink/15 border-y">
			{events.map((event) => (
				<li key={event.slug} className="py-4">
					<p className="font-semibold text-accent text-xs uppercase tracking-[0.14em]">
						{formatHistoricalDate(event.date)}
					</p>
					<h2 className="mt-1 font-serif text-xl font-medium">
						<Link
							href={`/events/${event.slug}`}
							className="inline-flex min-h-11 items-center underline-offset-4 hover:text-accent hover:underline"
						>
							{event.title}
						</Link>
					</h2>
				</li>
			))}
		</ul>
	);
}
