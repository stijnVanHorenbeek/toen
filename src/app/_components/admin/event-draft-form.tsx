"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { ActivityStage } from "./event-authoring-beat";
import {
	EventAuthoringProvider,
	useEventAuthoring,
} from "./event-authoring-context";
import { ClassificationStage, StoryStage } from "./event-authoring-fields";

const ReviewStage = dynamic(
	() => import("./event-authoring-review").then((module) => module.ReviewStage),
	{
		loading: () => (
			<p role="status" className="authoring-panel text-ink/70">
				{messages.admin.review.loading}
			</p>
		),
	},
);

export function EventDraftForm({
	topicLabels,
	topicOptions,
}: {
	topicLabels: Record<string, string>;
	topicOptions: string[];
}) {
	return (
		<EventAuthoringProvider
			topicOptions={topicOptions}
			topicLabels={topicLabels}
		>
			<EventAuthoringWorkspace />
		</EventAuthoringProvider>
	);
}

function EventAuthoringWorkspace() {
	const { state } = useEventAuthoring();
	const previousStep = useRef(state.step);
	useEffect(() => {
		if (previousStep.current === state.step) return;
		previousStep.current = state.step;
		if (Object.keys(state.errors).length > 0) return;
		const frame = requestAnimationFrame(() => {
			const heading = document.getElementById(
				[
					"story-stage-title",
					"classification-stage-title",
					"activity-stage-title",
					"review-stage-title",
				][state.step - 1],
			);
			heading?.focus();
			heading?.scrollIntoView({ block: "start" });
		});
		return () => cancelAnimationFrame(frame);
	}, [state.errors, state.step]);
	if (!state.storageReady) return null;
	if (state.restoredDraft) return <RestoreDraftDecision />;
	return (
		<div>
			<div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-ink/20 border-y py-4">
				<nav aria-label={messages.admin.progress}>
					<ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
						{messages.admin.steps.map((label, index) => (
							<li
								key={label}
								aria-current={state.step === index + 1 ? "step" : undefined}
								className={
									state.step === index + 1
										? "font-semibold text-accent"
										: "text-ink/65"
								}
							>
								{index + 1}. {label}
							</li>
						))}
					</ol>
				</nav>
				<SaveStatus />
			</div>
			{state.step === 1 ? <StoryStage /> : null}
			{state.step === 2 ? <ClassificationStage /> : null}
			{state.step === 3 ? <ActivityStage /> : null}
			{state.step === 4 ? <ReviewStage /> : null}
		</div>
	);
}

function RestoreDraftDecision() {
	const { actions } = useEventAuthoring();
	const headingRef = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		headingRef.current?.focus();
	}, []);
	return (
		<section
			aria-labelledby="restore-title"
			aria-describedby="restore-description"
			className="rounded-md border-2 border-accent bg-white p-6"
		>
			<h2
				ref={headingRef}
				id="restore-title"
				tabIndex={-1}
				className="font-serif text-2xl font-semibold"
			>
				{messages.admin.draft.found}
			</h2>
			<p id="restore-description" className="mt-2 max-w-2xl text-ink/75">
				{messages.admin.draft.foundDescription}
			</p>
			<div className="mt-5 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={actions.restoreDraft}
					className="primary-button"
				>
					{messages.admin.draft.restore}
				</button>
				<button
					type="button"
					onClick={actions.discardStoredDraft}
					className="secondary-button"
				>
					{messages.admin.draft.discard}
				</button>
			</div>
		</section>
	);
}

function SaveStatus() {
	const { state } = useEventAuthoring();
	const copy =
		state.saveStatus === "idle"
			? ""
			: {
					saving: messages.admin.draft.saving,
					saved: messages.admin.draft.saved,
					failed: messages.admin.draft.failed,
				}[state.saveStatus];
	return (
		<p
			role="status"
			aria-live="polite"
			aria-atomic="true"
			className="text-ink/70 text-sm"
		>
			{copy}
		</p>
	);
}
