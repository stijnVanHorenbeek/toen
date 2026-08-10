import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventArticle } from "@/app/_components/event-article";
import { getAllEvents, getEventBySlug } from "@/lib/content/events";
import { messages } from "@/lib/i18n/messages.nl-BE";

type EventPageProps = { params: Promise<{ slug: string }> };

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
		: { title: messages.event.notFound };
}

export default async function EventPage({ params }: EventPageProps) {
	const { slug } = await params;
	const event = await getEventBySlug(slug);
	if (!event) notFound();

	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-5xl items-baseline justify-between px-6 py-6 lg:px-10">
					<Link
						href="/"
						className="font-serif text-3xl font-semibold tracking-[-0.04em] transition-colors hover:text-accent"
					>
						{messages.site.name}
					</Link>
					<Link
						href="/"
						className="text-sm text-ink/55 underline-offset-4 hover:text-ink hover:underline"
					>
						{messages.event.allEvents}
					</Link>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-6 py-14 lg:px-10 lg:py-20">
				<EventArticle event={event} variant="page" />
			</main>
		</div>
	);
}
