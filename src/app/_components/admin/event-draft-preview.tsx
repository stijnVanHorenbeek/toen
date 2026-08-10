import type { EventDraftPreview as Preview } from "@/lib/content/event-draft";

export function EventDraftPreview({
	error,
	preview,
}: {
	error: string | null;
	preview: Preview | null;
}) {
	if (error) {
		return (
			<p role="alert" className="border-accent border-l-2 pl-4 text-accent">
				{error}
			</p>
		);
	}

	if (!preview) {
		return (
			<p className="text-sm leading-6 text-ink/55">
				Vul gebeurtenis in om doelpad en canonieke Markdown te controleren.
			</p>
		);
	}

	return (
		<div>
			<p className="break-all font-mono text-accent text-sm">{preview.path}</p>
			<pre
				data-testid="markdown-preview"
				className="mt-5 max-h-[42rem] overflow-auto whitespace-pre-wrap rounded-sm bg-ink p-5 text-paper text-sm leading-6"
			>
				{preview.markdown}
			</pre>
		</div>
	);
}
