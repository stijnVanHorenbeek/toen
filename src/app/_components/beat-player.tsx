"use client";

import Link from "next/link";
import { type Dispatch, useEffect, useReducer, useRef } from "react";
import { getBeatKeyboardAction } from "@/lib/beats/keyboard";
import {
	type BeatDurationMinutes,
	type BeatRuntimeAction,
	type BeatRuntimeState,
	createBeatRuntimeStages,
	createBeatRuntimeState,
	reduceBeatRuntime,
} from "@/lib/beats/runtime";
import type { InteractiveBeat } from "@/lib/content/event";
import type { Event } from "@/lib/content/event-document";
import { messages } from "@/lib/i18n/messages.nl-BE";

type BeatPlayerEvent = Pick<Event, "slug" | "title" | "sources"> & {
	beat: InteractiveBeat;
};

type BeatPlayerProps = {
	event: BeatPlayerEvent;
};

type BeatStagePanelProps = {
	beat: InteractiveBeat;
	stage: InteractiveBeat["stages"][number];
	sources: Event["sources"];
};

const durations: BeatDurationMinutes[] = [5, 8, 12];

export function BeatStagePanel({ beat, stage, sources }: BeatStagePanelProps) {
	if (stage.phase === "opening") {
		return (
			<article data-beat-phase={stage.phase} className="classroom-stage">
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					{messages.beat.phases.opening}
				</p>
				<h2 className="mt-3 text-balance font-serif text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.95]">
					{beat.question}
				</h2>
				<p className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(1.3rem,2.4vw,2.4rem)] leading-tight">
					{stage.stimulus}
				</p>
				{beat.mechanic === "source-duel" ? (
					<ul className="mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
						{beat.sourceCards.map((card) => {
							const source = sources.find(({ url }) => url === card.sourceUrl);
							return (
								<li
									key={card.id}
									data-source-card=""
									className="rounded-md border border-ink/25 bg-white px-5 py-4"
								>
									<p className="font-bold text-accent text-sm uppercase tracking-[0.12em]">
										{card.label}
									</p>
									<p className="mt-2 text-[clamp(1rem,1.7vw,1.4rem)] leading-snug">
										{card.excerpt}
									</p>
									{source ? (
										<p className="mt-3 break-all font-bold text-ink/55 text-xs uppercase tracking-[0.1em]">
											<cite className="not-italic">{source.title}</cite> ·{" "}
											{source.publisher}
										</p>
									) : null}
								</li>
							);
						})}
					</ul>
				) : null}
				{beat.mechanic === "context-decision" ? (
					<p
						data-beat-perspective
						className="mx-auto mt-6 max-w-4xl rounded-md border border-ink/20 bg-white px-6 py-4 text-[clamp(1rem,1.7vw,1.4rem)] leading-snug"
					>
						{beat.perspective}
					</p>
				) : null}
				{beat.mechanic === "vote-revote" ? <BeatChoices beat={beat} /> : null}
			</article>
		);
	}

	if (stage.phase === "commitment" || stage.phase === "revision") {
		return (
			<article data-beat-phase={stage.phase} className="classroom-stage">
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					{messages.beat.phases[stage.phase]}
				</p>
				<h2 className="mx-auto mt-5 max-w-5xl text-balance font-serif text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.95]">
					{stage.prompt}
				</h2>
				<BeatChoices beat={beat} />
			</article>
		);
	}

	if (stage.phase === "discussion" || stage.phase === "reasoning") {
		return (
			<article data-beat-phase={stage.phase} className="classroom-stage">
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					{messages.beat.phases[stage.phase]}
				</p>
				<h2 className="mx-auto mt-5 max-w-5xl text-balance font-serif text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.95]">
					{stage.prompt}
				</h2>
			</article>
		);
	}

	if (stage.phase === "resolution") {
		const resolutionSources = sources.filter(({ url }) =>
			stage.sourceUrls.includes(url),
		);
		return (
			<article data-beat-phase={stage.phase} className="classroom-stage">
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					{messages.beat.phases.resolution}
				</p>
				<h2 className="mt-3 text-balance font-serif text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.95]">
					{stage.title}
				</h2>
				<p className="mx-auto mt-7 max-w-5xl text-balance text-[clamp(1.3rem,2.6vw,2.6rem)] leading-tight">
					{stage.feedback}
				</p>
				{stage.misconception ? (
					<p className="mx-auto mt-5 max-w-4xl rounded-md border border-ink/20 bg-white px-5 py-4 text-[clamp(1rem,1.6vw,1.4rem)]">
						{stage.misconception}
					</p>
				) : null}
				<p className="mt-5 font-bold text-ink/60 text-sm uppercase tracking-[0.12em]">
					{resolutionSources
						.map(({ title, publisher }) => `${title} · ${publisher}`)
						.join(" | ")}
				</p>
			</article>
		);
	}

	if (stage.phase === "lesson-bridge") {
		return (
			<article data-beat-phase={stage.phase} className="classroom-stage">
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					{messages.beat.phases.lessonBridge}
				</p>
				<h2 className="mx-auto mt-5 max-w-5xl text-balance font-serif text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.95]">
					{stage.bridge}
				</h2>
				{beat.version === 2 && beat.vocationalConnection ? (
					<p className="mx-auto mt-6 max-w-4xl rounded-md border border-ink/20 bg-white px-5 py-4 text-[clamp(1rem,1.6vw,1.4rem)]">
						{beat.vocationalConnection}
					</p>
				) : null}
			</article>
		);
	}

	if (stage.phase === "evidence") {
		const source = sources.find(({ url }) => url === stage.sourceUrl);
		return (
			<article data-beat-phase={stage.phase} className="classroom-stage">
				<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
					{messages.beat.phases.evidence}
				</p>
				<h2 className="mt-3 text-balance font-serif text-[clamp(2.4rem,5vw,5.5rem)] font-medium leading-[0.95]">
					{stage.title}
				</h2>
				<p className="mx-auto mt-8 max-w-5xl text-balance text-[clamp(1.4rem,3vw,3rem)] leading-tight">
					{stage.evidence}
				</p>
				{source ? (
					<p className="mt-6 font-bold text-ink/60 text-sm uppercase tracking-[0.12em]">
						{source.title} · {source.publisher}
					</p>
				) : null}
			</article>
		);
	}

	return null;
}

function BeatChoices({ beat }: { beat: InteractiveBeat }) {
	return (
		<ul
			className={
				beat.choices.length === 4
					? "mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
					: "mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3"
			}
		>
			{beat.choices.map((choice) => (
				<li
					key={choice.id}
					className="rounded-md border border-ink/30 bg-white px-5 py-4 text-center font-bold text-[clamp(1rem,1.8vw,1.5rem)]"
				>
					{choice.label}
				</li>
			))}
		</ul>
	);
}

type BeatClassroomScreenProps = {
	event: BeatPlayerEvent;
	state: BeatRuntimeState;
	dispatch: Dispatch<BeatRuntimeAction>;
};

export function BeatClassroomScreen({
	event,
	state,
	dispatch,
}: BeatClassroomScreenProps) {
	if (state.status === "preparation") {
		return (
			<main className="classroom-shell flex min-h-screen items-center justify-center px-6 py-8">
				<section className="w-full max-w-4xl rounded-md border border-ink/20 bg-paper p-8 shadow-[0_24px_90px_rgb(33_31_26_/_12%)] sm:p-12">
					<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
						{messages.beat.preparation}
					</p>
					<h1
						data-beat-preparation
						tabIndex={-1}
						className="mt-4 text-balance font-serif text-4xl font-medium leading-none sm:text-6xl"
					>
						{event.title}
					</h1>
					{event.beat.version === 2 ? (
						<p className="mt-5 text-ink/70">
							<strong>{messages.beat.responseMethod}:</strong>{" "}
							{messages.beat.responseMethods[event.beat.responseMethod]}
						</p>
					) : null}
					<fieldset className="mt-10">
						<legend className="font-bold text-lg">
							{messages.beat.duration}
						</legend>
						<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
							{durations.map((durationMinutes) => (
								<label
									key={durationMinutes}
									className="flex min-h-14 cursor-pointer items-center justify-center rounded-md border border-ink/30 bg-white px-4 font-bold has-checked:border-accent has-checked:bg-accent has-checked:text-white"
								>
									<input
										type="radio"
										name="duration"
										value={durationMinutes}
										checked={state.durationMinutes === durationMinutes}
										onChange={() =>
											dispatch({
												type: "select-duration",
												durationMinutes,
											})
										}
										className="sr-only"
									/>
									{messages.beat.durations[durationMinutes]}
								</label>
							))}
						</div>
					</fieldset>
					<div className="mt-8 flex flex-wrap items-center gap-5">
						<button
							type="button"
							className="primary-button"
							onClick={() =>
								dispatch({
									type: "start",
									routeStages: createBeatRuntimeStages(
										event.beat,
										state.durationMinutes,
									),
								})
							}
						>
							{messages.beat.start}
						</button>
						<Link href={`/events/${event.slug}`} className="text-button">
							{messages.beat.article}
						</Link>
					</div>
					<p className="mt-6 text-ink/60 text-sm">
						{messages.beat.reloadNotice}
					</p>
				</section>
			</main>
		);
	}

	if (state.status === "finished") {
		return (
			<main className="classroom-shell flex min-h-screen items-center justify-center px-6 py-8 text-center">
				<section className="w-full max-w-3xl rounded-md border border-ink/20 bg-paper p-8 shadow-[0_24px_90px_rgb(33_31_26_/_12%)] sm:p-12">
					<p className="font-bold text-accent text-sm uppercase tracking-[0.18em]">
						{event.title}
					</p>
					<h1
						data-beat-completed
						tabIndex={-1}
						className="mt-4 text-balance font-serif text-5xl font-medium leading-none sm:text-7xl"
					>
						{messages.beat.completed}
					</h1>
					<p className="mt-5 text-ink/65 text-lg">
						{messages.beat.completedNote}
					</p>
					<div className="mt-9 flex flex-wrap items-center justify-center gap-5">
						<button
							type="button"
							className="primary-button"
							onClick={() => dispatch({ type: "reset" })}
						>
							{messages.beat.restart}
						</button>
						<Link href={`/events/${event.slug}`} className="text-button">
							{messages.beat.returnToArticle}
						</Link>
						<Link href="/" className="text-button">
							{messages.beat.home}
						</Link>
					</div>
				</section>
			</main>
		);
	}
	const routeStage = state.routeStages[state.currentStageIndex];
	const stage = event.beat.stages.find(({ id }) => id === routeStage.id);
	if (!stage) return null;
	const nextRouteStage = state.routeStages
		.slice(state.currentStageIndex + 1)
		.find(({ id }) => !state.skippedStageIds.includes(id));
	const nextLabel =
		nextRouteStage?.phase === "evidence"
			? messages.beat.controls.reveal
			: messages.beat.controls.next;

	return (
		<main className="classroom-runtime flex h-dvh flex-col overflow-hidden">
			<header className="flex shrink-0 items-center justify-between border-ink/15 border-b px-6 py-3">
				<p className="truncate font-bold">{event.title}</p>
				<p className="shrink-0 text-ink/60 text-sm">
					Stap {state.currentStageIndex + 1} van {state.routeStages.length}
				</p>
			</header>
			<div
				data-classroom-stage-region
				tabIndex={-1}
				aria-live="polite"
				className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-center"
			>
				<div className="flex min-h-full w-full items-center justify-center">
					<BeatStagePanel
						beat={event.beat}
						stage={stage}
						sources={event.sources}
					/>
				</div>
			</div>
			<footer className="flex shrink-0 flex-wrap items-center gap-2 border-ink/15 border-t bg-paper px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-3">
				<button
					type="button"
					className="secondary-button"
					disabled={state.currentStageIndex === 0}
					onClick={() => dispatch({ type: "back" })}
				>
					{messages.beat.controls.back}
				</button>
				{routeStage.optional ? (
					<button
						type="button"
						className="secondary-button"
						onClick={() => dispatch({ type: "skip" })}
					>
						{messages.beat.controls.skip}
					</button>
				) : null}
				<div className="hidden flex-1 sm:block" />
				<button
					type="button"
					className="text-button px-3"
					onClick={() => {
						if (window.confirm(messages.beat.resetConfirm)) {
							dispatch({ type: "reset" });
						}
					}}
				>
					{messages.beat.controls.reset}
				</button>
				{stage.phase === "lesson-bridge" ? (
					<button
						type="button"
						className="primary-button"
						onClick={() => dispatch({ type: "finish" })}
					>
						{messages.beat.controls.finish}
					</button>
				) : (
					<button
						type="button"
						className="primary-button"
						onClick={(event) => {
							if (event.detail > 1) return;
							dispatch({ type: "advance" });
						}}
					>
						{nextLabel}
					</button>
				)}
			</footer>
		</main>
	);
}

export function BeatPlayer({ event }: BeatPlayerProps) {
	const [state, dispatch] = useReducer(
		reduceBeatRuntime,
		undefined,
		createBeatRuntimeState,
	);
	const activeStageIndex =
		state.status === "running" ? state.currentStageIndex : null;
	const focusKey =
		activeStageIndex === null ? state.status : `running:${activeStageIndex}`;
	const previousFocusKey = useRef(focusKey);

	useEffect(() => {
		if (previousFocusKey.current === focusKey) return;
		previousFocusKey.current = focusKey;
		const selector =
			activeStageIndex !== null
				? "[data-classroom-stage-region]"
				: state.status === "finished"
					? "[data-beat-completed]"
					: "[data-beat-preparation]";
		document
			.querySelector<HTMLElement>(selector)
			?.focus({ preventScroll: true });
	}, [focusKey, state.status, activeStageIndex]);

	useEffect(() => {
		if (state.status !== "running") return;
		function handleKeyDown(event: KeyboardEvent) {
			const target = event.target instanceof Element ? event.target : null;
			const action = getBeatKeyboardAction({
				key: event.key,
				repeat: event.repeat,
				interactiveTarget: Boolean(
					target?.closest(
						"button, a, input, select, textarea, [contenteditable=true]",
					),
				),
			});
			if (!action) return;
			event.preventDefault();
			dispatch(action);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [state.status]);

	return (
		<BeatClassroomScreen event={event} state={state} dispatch={dispatch} />
	);
}
