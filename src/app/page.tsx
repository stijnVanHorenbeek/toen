import { toEventCatalogEntry } from "@/lib/content/event-catalog";
import { getAllEvents } from "@/lib/content/events";
import { EventExplorer } from "./_components/event-explorer/event-explorer";

export default async function Home() {
	const events = (await getAllEvents()).map(toEventCatalogEntry);

	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-6xl items-baseline justify-between px-6 py-6 lg:px-10">
					<h1 className="font-serif text-4xl font-semibold tracking-[-0.04em]">
						Toen.
					</h1>
					<p className="hidden text-sm text-ink/60 sm:block">
						Geschiedenis voor vandaag
					</p>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
				<section className="grid gap-8 border-ink/15 border-b pb-16 lg:grid-cols-[1.4fr_0.6fr] lg:pb-24">
					<div>
						<p className="mb-5 font-semibold text-accent text-xs uppercase tracking-[0.22em]">
							Een datum. Een verhaal.
						</p>
						<h2 className="max-w-4xl text-balance font-serif text-5xl font-medium leading-[0.96] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
							Het verleden begon niet gisteren.
						</h2>
					</div>
					<p className="max-w-md self-end text-pretty text-base leading-7 text-ink/65 lg:justify-self-end">
						Kies de week en lescontext. Toen. zoekt altijd naar bruikbare
						gebeurtenissen en toont duidelijke alternatieven wanneer nodig.
					</p>
				</section>

				<section aria-label="Gebeurtenissen" className="pt-12 lg:pt-16">
					<EventExplorer events={events} />
				</section>
			</main>

			<footer className="border-ink/15 border-t">
				<div className="mx-auto max-w-6xl px-6 py-8 text-sm text-ink/50 lg:px-10">
					Toen. — geschiedenis met bronvermelding.
				</div>
			</footer>
		</div>
	);
}
