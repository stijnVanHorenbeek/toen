import type { Metadata } from "next";
import Link from "next/link";
import { EventDraftForm } from "../_components/admin/event-draft-form";

export const metadata: Metadata = {
	title: "Nieuwe gebeurtenis",
	robots: { index: false, follow: false },
};

export default function AdminPage() {
	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-7xl items-baseline justify-between px-6 py-6 lg:px-10">
					<Link href="/" className="font-serif text-3xl font-semibold">
						Toen.
					</Link>
					<p className="font-mono text-ink/50 text-xs uppercase tracking-widest">
						Redactie
					</p>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
				<header className="mb-14 max-w-3xl border-ink/15 border-b pb-10">
					<p className="font-semibold text-accent text-xs uppercase tracking-[0.2em]">
						Git-backed inhoud
					</p>
					<h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
						Nieuwe gebeurtenis
					</h1>
					<p className="mt-5 text-base leading-7 text-ink/60">
						Genereer en controleer canonieke Markdown. Deze stap schrijft nog
						niets naar GitHub.
					</p>
				</header>

				<EventDraftForm />
			</main>
		</div>
	);
}
