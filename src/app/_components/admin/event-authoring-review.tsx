"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import type { InteractiveBeat } from "@/lib/content/event";
import type { Event } from "@/lib/content/event-document";
import { formatStep, formatVakrichting } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { BeatPlayer } from "../beat-player";
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
				step={formatStep(4, 4)}
				title={messages.admin.steps[3]}
				id="review-stage-title"
			>
				{messages.admin.reviewIntro}
			</StageHeader>
			<PublishStatus />
			<EventArticle event={event} variant="preview" />
			{event.beat ? <ClassroomPreview event={event} beat={event.beat} /> : null}
			{event.beat ? <TeacherCueReview beat={event.beat} /> : null}

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
					<button
						type="button"
						disabled={state.isPublishing}
						onClick={() => actions.goToStep(3)}
						className="text-button"
					>
						{messages.admin.actions.editActivity}
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

function ClassroomPreview({
	event,
	beat,
}: {
	event: Event;
	beat: InteractiveBeat;
}) {
	const [open, setOpen] = useState(false);
	const dialog = useRef<HTMLDialogElement>(null);
	const openButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (!open || !dialog.current) return;
		dialog.current.showModal();
		return () => dialog.current?.close();
	}, [open]);
	function close() {
		setOpen(false);
		requestAnimationFrame(() => openButton.current?.focus());
	}
	return (
		<section
			aria-labelledby="classroom-preview-title"
			className="mt-8 rounded-md border border-ink/25 bg-white p-6"
		>
			<h3
				id="classroom-preview-title"
				className="font-serif text-2xl font-semibold"
			>
				{messages.admin.review.classroomPreview}
			</h3>
			{beat.version === 2 ? (
				<div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
					<p>
						<strong>{messages.admin.review.responseMethod}:</strong>{" "}
						{messages.admin.fields.responseMethods[beat.responseMethod]}
					</p>
					{beat.vocationalConnection ? (
						<p>
							<strong>{messages.admin.review.vocationalConnection}:</strong>{" "}
							{beat.vocationalConnection}
						</p>
					) : null}
				</div>
			) : null}
			<button
				ref={openButton}
				type="button"
				onClick={() => setOpen(true)}
				className="secondary-button mt-5"
			>
				{messages.admin.actions.openClassroomPreview}
			</button>
			{open ? (
				<dialog
					ref={dialog}
					onCancel={(event) => {
						event.preventDefault();
						close();
					}}
					aria-label={messages.admin.review.classroomPreview}
					className="fixed inset-0 m-0 size-full max-h-none max-w-none border-0 bg-paper p-0 text-ink backdrop:bg-ink/70"
				>
					<button
						type="button"
						onClick={close}
						className="secondary-button fixed top-3 right-3 z-50 bg-paper"
					>
						{messages.admin.actions.closeClassroomPreview}
					</button>
					<div
						onClickCapture={(clickEvent) => {
							if (!(clickEvent.target instanceof Element)) return;
							if (!clickEvent.target.closest("a")) return;
							clickEvent.preventDefault();
							close();
						}}
					>
						<BeatPlayer event={{ ...event, beat }} />
					</div>
				</dialog>
			) : null}
		</section>
	);
}

function TeacherCueReview({ beat }: { beat: InteractiveBeat }) {
	return (
		<details className="mt-8 rounded-md border border-ink/25 bg-white p-6">
			<summary className="cursor-pointer font-serif text-xl font-semibold">
				{messages.admin.review.teacherCues}
			</summary>
			<ol className="mt-5 space-y-4">
				{beat.stages.map((stage) => (
					<li key={stage.id} className="rounded-md border border-ink/15 p-4">
						<h4 className="font-semibold">{reviewPhaseLabel(stage.phase)}</h4>
						<dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
							<div>
								<dt className="font-semibold text-ink/65">
									{messages.admin.review.teacherPrompt}
								</dt>
								<dd className="mt-1">{stage.teacherPrompt}</dd>
							</div>
							<div>
								<dt className="font-semibold text-ink/65">
									{messages.admin.review.studentAction}
								</dt>
								<dd className="mt-1">{stage.expectedStudentAction}</dd>
							</div>
							<div>
								<dt className="font-semibold text-ink/65">
									{messages.admin.review.suggestedTime}
								</dt>
								<dd className="mt-1">{stage.suggestedSeconds} seconden</dd>
							</div>
						</dl>
					</li>
				))}
			</ol>
		</details>
	);
}

function reviewPhaseLabel(phase: InteractiveBeat["stages"][number]["phase"]) {
	if (phase === "lesson-bridge") return messages.beat.phases.lessonBridge;
	return messages.beat.phases[phase];
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
