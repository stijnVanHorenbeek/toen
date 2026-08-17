import Link from "next/link";
import type { ReactNode } from "react";
import { messages } from "@/lib/i18n/messages.nl-BE";

export function EventArchiveShell({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<div className="min-h-screen">
			<header className="border-ink/15 border-b">
				<div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
					<Link href="/" className="font-serif text-2xl font-semibold">
						{messages.site.name}
					</Link>
					<Link
						href="/"
						className="text-button inline-flex min-h-11 items-center"
					>
						{messages.archive.backHome}
					</Link>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-10">
				<h1 className="font-serif text-4xl font-semibold tracking-tight">
					{title}
				</h1>
				{children}
			</main>
		</div>
	);
}
