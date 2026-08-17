import Link from "next/link";
import { toEventCatalogEntry } from "@/lib/content/event-catalog";
import { createEventExplorerBootstrap } from "@/lib/content/event-explorer-data";
import { getAllEvents } from "@/lib/content/events";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { EventExplorer } from "./_components/event-explorer/event-explorer";

export default async function Home() {
	const releaseId = process.env.TOEN_DISCOVERY_RELEASE_ID;
	const searchIndexUrl = process.env.TOEN_SEARCH_INDEX_URL;
	const workerUrl = process.env.TOEN_EVENT_SEARCH_WORKER_URL;
	if (!releaseId || !searchIndexUrl || !workerUrl) {
		throw new Error("Missing generated discovery build configuration");
	}
	const bootstrap = createEventExplorerBootstrap(
		(await getAllEvents()).map(toEventCatalogEntry),
		{ releaseId, workerUrl },
	);
	if (bootstrap.searchIndexUrl !== searchIndexUrl) {
		throw new Error("Discovery search URL does not match release ID");
	}
	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-10">
					<Link
						href="/"
						className="flex min-h-11 shrink-0 items-center font-serif text-2xl font-semibold tracking-[-0.04em]"
					>
						{messages.site.name}
					</Link>
					<Link
						href="/admin"
						className="text-button inline-flex shrink-0 items-center text-sm"
					>
						{messages.home.createActivity}
					</Link>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
				<section aria-label={messages.home.events}>
					<EventExplorer bootstrap={bootstrap} />
				</section>
				<nav
					aria-label={messages.archive.title}
					className="mt-10 border-ink/15 border-t pt-6"
				>
					<Link
						href="/archive"
						className="text-button inline-flex min-h-11 items-center"
					>
						{messages.archive.browseAll}
					</Link>
				</nav>
			</main>
		</div>
	);
}
