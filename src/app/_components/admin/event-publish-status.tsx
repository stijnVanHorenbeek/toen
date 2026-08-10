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
				GitHub App-credentials ontbreken. Preview blijft beschikbaar.
			</p>
		);
	}

	if (result?.status === "created") {
		return (
			<p className="mb-6 border-green-700 border-l-2 pl-4 text-sm leading-6">
				Pull request {result.pullRequestNumber} gemaakt.{" "}
				<a
					href={result.pullRequestUrl}
					target="_blank"
					rel="noreferrer"
					className="font-semibold underline underline-offset-4"
				>
					Open op GitHub
				</a>
			</p>
		);
	}

	return null;
}
