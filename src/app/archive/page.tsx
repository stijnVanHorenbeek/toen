import Link from "next/link";
import { EventArchiveShell } from "@/app/_components/event-archive-shell";
import { getArchiveEventCatalog } from "@/lib/content/event-archive-loader";
import {
	createPeriodArchives,
	createTopicArchives,
} from "@/lib/content/event-archives";
import { historicalDateMessages } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";

export default async function ArchiveIndexPage() {
	const events = await getArchiveEventCatalog();
	const periods = createPeriodArchives(events);
	const topics = createTopicArchives(events);
	return (
		<EventArchiveShell title={messages.archive.title}>
			<p className="mt-4 max-w-2xl text-ink/65 leading-7">
				{messages.archive.intro}
			</p>
			<div className="mt-10 grid gap-10 md:grid-cols-2">
				<ArchiveLinks id="archive-periods" title={messages.archive.periods}>
					{periods.map((period) => (
						<Link
							key={period.id}
							href={`/archive/periods/${period.id}`}
							className="inline-flex min-h-11 items-center text-button"
						>
							{formatSignedYear(period.minimumYear)}–
							{formatSignedYear(period.maximumYear)}
						</Link>
					))}
				</ArchiveLinks>
				<ArchiveLinks id="archive-topics" title={messages.archive.topics}>
					{topics.map((topic) => (
						<Link
							key={topic.id}
							href={`/archive/topics/${topic.id}`}
							className="inline-flex min-h-11 items-center text-button"
						>
							{topic.label}
						</Link>
					))}
				</ArchiveLinks>
			</div>
		</EventArchiveShell>
	);
}

function ArchiveLinks({
	children,
	id,
	title,
}: {
	children: React.ReactNode;
	id: string;
	title: string;
}) {
	return (
		<section aria-labelledby={id}>
			<h2 id={id} className="font-serif text-2xl font-semibold">
				{title}
			</h2>
			<div className="mt-3 grid gap-1">{children}</div>
		</section>
	);
}

function formatSignedYear(year: number): string {
	return year < 0
		? `${Math.abs(year)} ${historicalDateMessages.beforeCommonEra}`
		: `${year} ${historicalDateMessages.afterCommonEra}`;
}
