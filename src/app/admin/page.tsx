import type { Metadata } from "next";
import Link from "next/link";
import { collectTopicLabels } from "@/lib/content/event-catalog";
import { getAllEvents } from "@/lib/content/events";
import { compareLocalized } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { EventDraftForm } from "../_components/admin/event-draft-form";

export const metadata: Metadata = {
	title: messages.admin.title,
	robots: { index: false, follow: false },
};

export default async function AdminPage() {
	const events = await getAllEvents();
	const topicOptions = [
		...new Set(events.flatMap((event) => event.topics)),
	].sort(compareLocalized);
	const topicLabels = collectTopicLabels(events);
	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-7xl items-baseline justify-between px-6 py-6 lg:px-10">
					<Link href="/" className="font-serif text-3xl font-semibold">
						{messages.site.name}
					</Link>
					<p className="font-mono text-ink/70 text-xs uppercase tracking-widest">
						{messages.admin.eyebrow}
					</p>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-6 py-12 lg:px-10 lg:py-16">
				<header className="mb-10 max-w-3xl">
					<p className="font-semibold text-accent text-xs uppercase tracking-[0.2em]">
						{messages.admin.eyebrow}
					</p>
					<h1 className="mt-4 text-balance font-serif text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
						{messages.admin.title}
					</h1>
					<p className="mt-5 text-pretty text-base leading-7 text-ink/75">
						{messages.admin.intro}
					</p>
				</header>

				<EventDraftForm topicOptions={topicOptions} topicLabels={topicLabels} />
			</main>
		</div>
	);
}
