import type { EventPublishResult } from "./use-event-draft";

export function EventPublishStatus({
	error,
	result,
}: {
	error: string | null;
	result: EventPublishResult | null;
}) {
	if (error) {
		return (
			<p
				role="alert"
				className="mb-6 border-accent border-l-2 pl-4 text-accent"
			>
				{error}
			</p>
		);
	}

	if (result?.status === "dry-run") {
		return (
			<p className="mb-6 border-amber-700 border-l-2 pl-4 text-sm leading-6">
				<strong className="block">Niets naar GitHub geschreven</strong>
				Publiceren staat in dry-runmodus. Preview blijft beschikbaar.
			</p>
		);
	}

	if (result?.status === "committed-trigger-failed") {
		return (
			<p
				role="alert"
				className="mb-6 border-amber-700 border-l-2 pl-4 text-sm leading-6"
			>
				<strong className="block">Commit opgeslagen</strong>
				Deployment kon niet worden gestart. Probeer opnieuw; dezelfde inhoud
				wordt niet dubbel opgeslagen. <CommitLink url={result.commitUrl} />
			</p>
		);
	}

	if (result?.status === "committed-and-triggered") {
		return (
			<p className="mb-6 border-green-700 border-l-2 pl-4 text-sm leading-6">
				Commit opgeslagen en deployment gestart.{" "}
				<CommitLink url={result.commitUrl} />
			</p>
		);
	}

	return null;
}

function CommitLink({ url }: { url: string }) {
	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className="font-semibold underline underline-offset-4"
		>
			Open commit op GitHub
		</a>
	);
}
