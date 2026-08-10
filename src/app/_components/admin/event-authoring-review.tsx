"use client";

import { type RefObject, useEffect, useRef } from "react";
import { formatStep, formatVakrichting } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { EventArticle } from "../event-article";
import { useEventAuthoring } from "./event-authoring-context";
import { StageActions, StageHeader } from "./event-authoring-fields";

export function ReviewStage() {
	const { state, actions } = useEventAuthoring();
	const preview = state.preview;
	const publishButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!preview) return;
		const frame = requestAnimationFrame(() => {
			const heading = document.getElementById("review-stage-title");
			heading?.focus();
			heading?.scrollIntoView({ block: "start" });
		});
		return () => cancelAnimationFrame(frame);
	}, [preview]);
	if (!preview) return null;
	const event = preview.event;
	const finished = state.publishResult?.status === "committed-and-triggered";
	return (
		<section aria-labelledby="review-stage-title" className="authoring-panel">
			<StageHeader
				step={formatStep(3, 3)}
				title={messages.admin.steps[2]}
				id="review-stage-title"
			>
				{messages.admin.reviewIntro}
			</StageHeader>
			<PublishStatus />
			<EventArticle event={event} variant="preview" />

			<div className="mt-8 grid gap-6 rounded-md border border-ink/25 bg-white p-6 sm:grid-cols-2">
				<div>
					<h3 className="font-serif text-xl font-semibold">
						{messages.admin.review.profiles}
					</h3>
					<p className="mt-2 text-ink/75">
						{event.profiles.map(formatVakrichting).join(", ")}
					</p>
				</div>
			</div>

			<div className="mt-8 rounded-md border border-ink/25 bg-white p-6">
				<h3 className="font-serif text-xl font-semibold">
					{messages.admin.review.publicUrl}
				</h3>
				<p data-testid="event-url" className="mt-2 break-words text-accent">
					/events/{event.slug}
				</p>
				<details className="mt-5 border-ink/20 border-t pt-5">
					<summary className="cursor-pointer font-semibold">
						{messages.admin.review.technical}
					</summary>
					<p className="mt-4 break-all font-mono text-sm">{preview.path}</p>
					<pre
						data-testid="markdown-preview"
						className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-sm bg-ink p-4 text-paper text-sm leading-6"
					>
						{preview.markdown}
					</pre>
				</details>
			</div>

			{finished ? null : (
				<StageActions>
					<button
						type="button"
						disabled={state.isPublishing}
						onClick={() => actions.goToStep(1)}
						className="text-button"
					>
						{messages.admin.actions.editStory}
					</button>
					<button
						type="button"
						disabled={state.isPublishing}
						onClick={() => actions.goToStep(2)}
						className="text-button"
					>
						{messages.admin.actions.editClassification}
					</button>
					{state.publishResult?.status === "committed-trigger-failed" ? (
						<button
							type="button"
							disabled={state.isPublishing}
							onClick={() => void actions.publish()}
							className="primary-button"
						>
							{messages.admin.actions.retryUpdate}
						</button>
					) : (
						<button
							ref={publishButton}
							type="button"
							disabled={state.isPublishing}
							onClick={actions.openConfirmation}
							className="primary-button"
						>
							{state.isPublishing
								? messages.admin.actions.publishing
								: messages.admin.actions.publish}
						</button>
					)}
				</StageActions>
			)}
			<PublicationConfirmation returnFocusRef={publishButton} />
		</section>
	);
}

function PublishStatus() {
	const { state } = useEventAuthoring();
	const result = state.publishResult;
	return (
		<div role="status" aria-live="polite" aria-atomic="true">
			{state.publishError ? (
				<p
					role="alert"
					className="mb-7 rounded-md border border-accent bg-white p-4 font-semibold text-accent"
				>
					{state.publishError}
				</p>
			) : state.isPublishing ? (
				<p className="mb-7 rounded-md border border-ink/25 bg-white p-4 font-semibold">
					{messages.admin.actions.publishing}
				</p>
			) : result?.status === "dry-run" ? (
				<p className="mb-7 rounded-md border border-amber-700 bg-white p-4">
					<strong className="block">
						{messages.admin.status.notPublished}
					</strong>
					{messages.admin.status.dryRun}
				</p>
			) : result?.status === "committed-trigger-failed" ? (
				<div
					role="alert"
					className="mb-7 rounded-md border border-amber-700 bg-white p-4"
				>
					<strong className="block">{messages.admin.status.saved}</strong>
					{messages.admin.status.updateFailed}{" "}
					<CommitLink url={result.commitUrl} />
				</div>
			) : result?.status === "committed-and-triggered" ? (
				<div className="mb-7 rounded-md border border-green-800 bg-white p-5">
					<strong className="block font-serif text-2xl">
						{messages.admin.status.saved}
					</strong>
					<p className="mt-2">{messages.admin.status.updateStarted}</p>
					<CommitLink url={result.commitUrl} />
				</div>
			) : null}
		</div>
	);
}

function CommitLink({ url }: { url: string }) {
	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className="font-semibold underline underline-offset-4"
		>
			{messages.admin.status.storedVersion}
		</a>
	);
}

function PublicationConfirmation({
	returnFocusRef,
}: {
	returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
	const { state, actions } = useEventAuthoring();
	const dialog = useRef<HTMLDialogElement>(null);
	const cancelButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!state.confirmationOpen || !dialog.current) return;
		dialog.current.showModal();
		cancelButton.current?.focus();
		return () => dialog.current?.close();
	}, [state.confirmationOpen]);
	if (!state.confirmationOpen || !state.preview) return null;
	function closeAndReturnFocus() {
		actions.closeConfirmation();
		requestAnimationFrame(() => returnFocusRef.current?.focus());
	}
	return (
		<dialog
			ref={dialog}
			onCancel={(event) => {
				event.preventDefault();
				closeAndReturnFocus();
			}}
			aria-labelledby="publication-dialog-title"
			aria-describedby="publication-dialog-description"
			aria-modal="true"
			className="fixed inset-0 z-50 m-auto w-[min(92vw,34rem)] rounded-md border-0 bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/60"
		>
			<div className="p-6 sm:p-8">
				<p className="font-semibold text-accent text-xs uppercase tracking-[0.18em]">
					{messages.admin.dialog.eyebrow}
				</p>
				<h2
					id="publication-dialog-title"
					className="mt-3 font-serif text-3xl font-semibold"
				>
					{messages.admin.dialog.title}
				</h2>
				<p
					id="publication-dialog-description"
					className="mt-5 text-base leading-7"
				>
					{messages.admin.dialog.descriptionBefore}{" "}
					<strong>{state.preview.event.title}</strong>.{" "}
					{messages.admin.dialog.descriptionAfter}
				</p>
				<div className="mt-7 flex flex-wrap gap-3">
					<button
						type="button"
						disabled={state.isPublishing}
						onClick={() => void actions.publish()}
						className="primary-button"
					>
						{messages.admin.actions.publishEvent}
					</button>
					<button
						ref={cancelButton}
						type="button"
						onClick={closeAndReturnFocus}
						className="secondary-button"
					>
						{messages.admin.actions.cancelPublish}
					</button>
				</div>
			</div>
		</dialog>
	);
}
