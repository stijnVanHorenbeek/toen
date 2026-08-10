import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatHistoricalDate } from "@/lib/content/event";
import { getAllEvents, getEventBySlug } from "@/lib/content/events";

type EventPageProps = {
	params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
	const events = await getAllEvents();
	return events.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
	params,
}: EventPageProps): Promise<Metadata> {
	const { slug } = await params;
	const event = await getEventBySlug(slug);

	return event
		? { title: event.title, description: event.summary }
		: { title: "Niet gevonden" };
}

export default async function EventPage({ params }: EventPageProps) {
	const { slug } = await params;
	const event = await getEventBySlug(slug);
	if (!event) {
		notFound();
	}

	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-5xl items-baseline justify-between px-6 py-6 lg:px-10">
					<Link
						href="/"
						className="font-serif text-3xl font-semibold tracking-[-0.04em] transition-colors hover:text-accent"
					>
						Toen.
					</Link>
					<Link
						href="/"
						className="text-sm text-ink/55 underline-offset-4 hover:text-ink hover:underline"
					>
						Alle gebeurtenissen
					</Link>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-6 py-14 lg:px-10 lg:py-20">
				<article>
					<header className="border-ink/15 border-b pb-12 lg:pb-16">
						<p className="font-semibold text-accent text-sm uppercase tracking-[0.18em]">
							{formatHistoricalDate(event.date)}
						</p>
						<h1 className="mt-5 max-w-4xl text-balance font-serif text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl">
							{event.title}
						</h1>
						<p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-ink/65">
							{event.summary}
						</p>
					</header>

					<div className="grid gap-14 pt-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:pt-16">
						<div className="prose-event max-w-2xl">
							<ReactMarkdown>{event.body}</ReactMarkdown>
						</div>

						<aside className="border-ink/15 border-t pt-5 lg:border-t-0 lg:border-l lg:pl-7 lg:pt-0">
							<h2 className="font-semibold text-xs uppercase tracking-[0.2em]">
								Bronnen
							</h2>
							<ul className="mt-5 space-y-5">
								{event.sources.map((source) => (
									<li key={source.url}>
										<a
											href={source.url}
											target="_blank"
											rel="noreferrer"
											className="font-serif text-lg decoration-accent/50 underline underline-offset-4 hover:text-accent"
										>
											{source.title}
										</a>
										<p className="mt-1 text-ink/50 text-xs leading-5">
											{source.publisher}
										</p>
									</li>
								))}
							</ul>
						</aside>
					</div>
				</article>
			</main>
		</div>
	);
}
