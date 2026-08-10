"use client";

import type { FormEvent } from "react";
import { EventDraftFields } from "./event-draft-fields";
import { EventDraftPreview } from "./event-draft-preview";
import { EventPublishStatus } from "./event-publish-status";
import { useEventDraft } from "./use-event-draft";

export function EventDraftForm() {
	const draft = useEventDraft();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void draft.requestPreview(new FormData(event.currentTarget));
	}

	return (
		<form
			onSubmit={submit}
			onInput={draft.invalidatePreview}
			className="grid gap-12 lg:grid-cols-[1fr_0.8fr]"
		>
			<div>
				<EventDraftFields />
				<div className="mt-8 flex flex-wrap gap-3">
					<button
						type="submit"
						disabled={draft.isPreviewing || draft.isPublishing}
						className="min-h-12 bg-accent px-6 font-semibold text-paper disabled:cursor-wait disabled:opacity-60"
					>
						{draft.isPreviewing ? "Preview genereren…" : "Genereer preview"}
					</button>
					<button
						type="button"
						disabled={!draft.canPublish || draft.isPublishing}
						onClick={() => void draft.requestPublish()}
						className="min-h-12 border border-ink/30 px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
					>
						{draft.isPublishing ? "Publiceren…" : "Publiceer gebeurtenis"}
					</button>
				</div>
			</div>
			<aside aria-live="polite" className="lg:sticky lg:top-8 lg:self-start">
				<h2 className="mb-5 font-serif text-2xl font-semibold">
					Markdown-preview
				</h2>
				<EventPublishStatus
					error={draft.publishError}
					result={draft.publishResult}
				/>
				<EventDraftPreview error={draft.previewError} preview={draft.preview} />
			</aside>
		</form>
	);
}
