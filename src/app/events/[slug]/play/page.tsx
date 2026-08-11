import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BeatPlayer } from "@/app/_components/beat-player";
import { getAllEvents, getEventBySlug } from "@/lib/content/events";
import { messages } from "@/lib/i18n/messages.nl-BE";

type BeatPlayPageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
	const events = await getAllEvents();
	return events.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
	params,
}: BeatPlayPageProps): Promise<Metadata> {
	const { slug } = await params;
	const event = await getEventBySlug(slug);
	return event
		? { title: event.title, description: event.summary }
		: { title: messages.event.notFound };
}

export default async function BeatPlayPage({ params }: BeatPlayPageProps) {
	const { slug } = await params;
	const event = await getEventBySlug(slug);
	if (!event) notFound();

	if (!event.beat) {
		return (
			<main className="classroom-shell flex min-h-screen items-center justify-center px-6 py-8 text-center">
				<section className="w-full max-w-3xl rounded-md border border-ink/20 bg-paper p-8 shadow-[0_24px_90px_rgb(33_31_26_/_12%)] sm:p-12">
					<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
						{messages.site.name}
					</p>
					<h1 className="mt-4 text-balance font-serif text-4xl font-medium leading-none sm:text-6xl">
						{event.title}
					</h1>
					<p className="mt-6 text-ink/65 text-lg">
						{messages.beat.unavailable}
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-5">
						<Link
							href={`/events/${event.slug}`}
							className="primary-button flex items-center"
						>
							{messages.beat.article}
						</Link>
						<Link href="/" className="text-button flex items-center">
							{messages.beat.home}
						</Link>
					</div>
				</section>
			</main>
		);
	}

	return (
		<BeatPlayer
			event={{
				slug: event.slug,
				title: event.title,
				sources: event.sources,
				beat: event.beat,
			}}
		/>
	);
}
