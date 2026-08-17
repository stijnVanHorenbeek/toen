"use client";

import Link from "next/link";
import {
	type CSSProperties,
	type Dispatch,
	useEffect,
	useRef,
	useState,
} from "react";
import { HistoricalVisualFigure } from "@/app/_components/historical-visual";
import {
	type BeatDurationMinutes,
	type BeatRuntimeAction,
	type BeatRuntimeState,
	createBeatRuntimeStages,
} from "@/lib/beats/runtime";
import { getEventVisual } from "@/lib/content/event-media";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { BeatStagePanel } from "./stage-components";
import type { BeatPlayerEvent, BeatPlayerVariant } from "./types";
import { useDeckGestures } from "./use-deck-gestures";

const durations: BeatDurationMinutes[] = [5, 8, 12];
type ActiveBeatRuntimeState = Exclude<
	BeatRuntimeState,
	{ status: "preparation" }
>;

type BeatClassroomScreenProps = {
	event: BeatPlayerEvent;
	state: BeatRuntimeState;
	dispatch: Dispatch<BeatRuntimeAction>;
	onStop?: () => void;
	variant?: BeatPlayerVariant;
};

export function BeatClassroomScreen({
	event,
	state,
	dispatch,
	onStop,
	variant = "page",
}: BeatClassroomScreenProps) {
	if (state.status === "preparation") {
		return (
			<PreparationScreen
				event={event}
				state={state}
				dispatch={dispatch}
				variant={variant}
			/>
		);
	}
	if (state.status === "finished") {
		return (
			<CompletionScreen event={event} dispatch={dispatch} variant={variant} />
		);
	}
	return (
		<RuntimeScreen
			event={event}
			state={state}
			dispatch={dispatch}
			onStop={onStop}
			variant={variant}
		/>
	);
}

function PreparationScreen({
	event,
	state,
	dispatch,
	variant,
}: Pick<BeatClassroomScreenProps, "event" | "dispatch" | "variant"> & {
	state: Extract<BeatRuntimeState, { status: "preparation" }>;
}) {
	const visual = getEventVisual(event.slug);
	const sensitivityNotes = event.beat.sensitivityNotes ?? [];
	return (
		<main
			className={`@container/classroom-preparation flex min-h-0 items-center justify-center overflow-hidden p-2 sm:p-6 lg:p-8 ${variant === "preview" ? "h-full" : "h-dvh"}`}
		>
			<section
				data-beat-preparation-panel
				className={`w-full max-w-6xl overflow-hidden rounded-md border border-ink/20 bg-paper shadow-[0_24px_90px_rgb(33_31_26_/_12%)] ${
					visual
						? "grid max-h-full grid-cols-1 grid-rows-[auto_auto] [@media(min-width:40rem)_and_(max-height:48rem)]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] [@media(min-width:40rem)_and_(max-height:48rem)]:grid-rows-1 @min-[60rem]/classroom-preparation:grid-cols-[minmax(0,1.05fr)_minmax(30rem,1fr)] @min-[60rem]/classroom-preparation:grid-rows-1"
						: "max-w-4xl"
				}`}
			>
				{visual ? (
					<HistoricalVisualFigure
						visual={visual}
						showCaption={false}
						className="classroom-preparation-visual grid min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-ink text-paper @min-[60rem]/classroom-preparation:min-h-[36rem]"
						imageClassName="aspect-[16/4] h-auto min-h-0 w-full object-cover [@media(min-width:40rem)_and_(max-height:48rem)]:aspect-auto [@media(min-width:40rem)_and_(max-height:48rem)]:h-full @min-[60rem]/classroom-preparation:aspect-auto @min-[60rem]/classroom-preparation:h-full"
						captionClassName="min-h-11 px-3 py-1 text-xs leading-4 @min-[60rem]/classroom-preparation:px-5 @min-[60rem]/classroom-preparation:py-4 @min-[60rem]/classroom-preparation:text-sm"
					/>
				) : null}
				<div className="flex min-h-0 flex-col justify-center p-3 sm:p-8 [@media(min-width:40rem)_and_(max-height:48rem)]:p-4 @min-[60rem]/classroom-preparation:p-12 [@media(max-height:32rem)]:p-3">
					<p className="font-bold text-accent text-xs uppercase tracking-[0.18em] sm:text-sm">
						{messages.beat.preparation}
					</p>
					<h1
						data-beat-preparation
						tabIndex={-1}
						className="mt-2 text-balance font-serif text-[clamp(1.7rem,8.4vw,3rem)] font-medium leading-none @min-[60rem]/classroom-preparation:mt-4 @min-[60rem]/classroom-preparation:text-6xl [@media(max-height:32rem)]:text-[clamp(1.65rem,4.2vw,2.5rem)]"
					>
						{event.title}
					</h1>
					{event.beat.version === 2 || sensitivityNotes.length > 0 ? (
						<div
							data-classroom-setup
							className="mt-2 space-y-1 rounded-md bg-white p-2 text-ink/75 text-xs leading-4 @min-[60rem]/classroom-preparation:mt-5 @min-[60rem]/classroom-preparation:space-y-2 @min-[60rem]/classroom-preparation:p-3 @min-[60rem]/classroom-preparation:text-sm"
						>
							{event.beat.version === 2 ? (
								<p>
									<strong>{messages.beat.responseMethod}:</strong>{" "}
									{messages.beat.responseMethods[event.beat.responseMethod]}
								</p>
							) : null}
							{sensitivityNotes.map((note, index) => (
								<p key={note} data-classroom-sensitivity>
									<strong>
										{messages.beat.sensitivity}
										{sensitivityNotes.length > 1 ? ` ${index + 1}` : ""}:
									</strong>{" "}
									{note}
								</p>
							))}
						</div>
					) : null}
					<DurationPicker state={state} dispatch={dispatch} />
					<div className="classroom-preparation-actions mt-3 flex flex-wrap items-center gap-3 @min-[60rem]/classroom-preparation:mt-8 @min-[60rem]/classroom-preparation:gap-5 [@media(max-height:32rem)]:mt-2">
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
					<p className="mt-6 hidden text-ink/60 text-sm @min-[60rem]/classroom-preparation:block">
						{messages.beat.reloadNotice}
					</p>
				</div>
			</section>
		</main>
	);
}

function DurationPicker({
	state,
	dispatch,
}: {
	state: Extract<BeatRuntimeState, { status: "preparation" }>;
	dispatch: Dispatch<BeatRuntimeAction>;
}) {
	return (
		<fieldset className="mt-3 @min-[60rem]/classroom-preparation:mt-10 [@media(max-height:32rem)]:mt-2">
			<legend className="font-bold text-sm @min-[60rem]/classroom-preparation:text-lg">
				{messages.beat.duration}
			</legend>
			<div
				className="classroom-duration-grid mt-2 @min-[60rem]/classroom-preparation:mt-4"
				style={
					{
						"--duration-index": durations.indexOf(state.durationMinutes),
					} as CSSProperties
				}
			>
				<span aria-hidden="true" className="classroom-duration-selection" />
				{durations.map((durationMinutes) => (
					<label
						key={durationMinutes}
						className="relative z-10 flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-sm px-2 font-bold focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-3 @min-[60rem]/classroom-preparation:min-h-12"
					>
						<input
							type="radio"
							name="duration"
							value={durationMinutes}
							checked={state.durationMinutes === durationMinutes}
							aria-label={messages.beat.durations[durationMinutes]}
							onChange={() =>
								dispatch({ type: "select-duration", durationMinutes })
							}
							className="peer sr-only"
						/>
						<span className="hidden peer-checked:text-white @min-[40rem]/classroom-preparation:inline">
							{messages.beat.durations[durationMinutes]}
						</span>
						<span className="peer-checked:text-white @min-[40rem]/classroom-preparation:hidden">
							{messages.beat.compactDurations[durationMinutes]}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function CompletionScreen({
	event,
	dispatch,
	variant,
}: Pick<BeatClassroomScreenProps, "event" | "dispatch" | "variant">) {
	return (
		<main
			className={`flex items-center justify-center px-6 py-8 text-center ${variant === "preview" ? "h-full min-h-0" : "min-h-screen"}`}
		>
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
					<Link href="/" className="primary-button">
						{messages.beat.home}
					</Link>
					<Link href={`/events/${event.slug}`} className="text-button">
						{messages.beat.returnToArticle}
					</Link>
					<button
						type="button"
						className="text-button"
						onClick={() => dispatch({ type: "reset" })}
					>
						{messages.beat.restart}
					</button>
				</div>
			</section>
		</main>
	);
}

function RuntimeScreen({
	event,
	state,
	dispatch,
	onStop,
	variant,
}: Pick<
	BeatClassroomScreenProps,
	"event" | "dispatch" | "onStop" | "variant"
> & {
	state: ActiveBeatRuntimeState;
}) {
	const visual = getEventVisual(event.slug);
	const previousStageIndex = useRef<number | null>(null);
	const stageRegion = useRef<HTMLDivElement | null>(null);
	const [hasMoreContent, setHasMoreContent] = useState(false);
	const routeStage = state.routeStages[state.currentStageIndex];
	const stage = event.beat.stages.find(({ id }) => id === routeStage.id);
	const transitionDirection =
		previousStageIndex.current !== null &&
		state.currentStageIndex < previousStageIndex.current
			? "back"
			: "forward";
	useEffect(() => {
		previousStageIndex.current = state.currentStageIndex;
	}, [state.currentStageIndex]);
	const gestures = useDeckGestures({
		canFinish: routeStage.phase === "lesson-bridge",
		canGoBack: state.currentStageIndex > 0,
		dispatch,
		enabled: true,
		stageRegion,
	});
	useEffect(() => {
		const activeStageId = routeStage.id;
		const element = stageRegion.current;
		if (!element) return;
		const update = () => {
			setHasMoreContent(
				element.scrollTop + element.clientHeight < element.scrollHeight - 1,
			);
		};
		setHasMoreContent(false);
		const frame = requestAnimationFrame(() => {
			if (routeStage.id === activeStageId) update();
		});
		const observer = new ResizeObserver(update);
		observer.observe(element);
		const content = element.firstElementChild;
		if (content) observer.observe(content);
		element.addEventListener("scroll", update, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			element.removeEventListener("scroll", update);
		};
	}, [routeStage.id]);
	if (!stage) return null;
	const nextRouteStage = state.routeStages
		.slice(state.currentStageIndex + 1)
		.find(({ id }) => !state.skippedStageIds.includes(id));
	const nextLabel =
		nextRouteStage?.phase === "evidence"
			? messages.beat.controls.reveal
			: messages.beat.controls.next;
	const stageVisual =
		visual &&
		((stage.phase === "opening" && event.beat.mechanic !== "source-duel") ||
			stage.phase === "evidence" ||
			stage.phase === "resolution")
			? visual
			: null;
	const visualStage = Boolean(stageVisual);
	const sourceComparisonStage =
		stage.phase === "opening" && event.beat.mechanic === "source-duel";
	return (
		<main
			data-classroom-player-variant={variant}
			className={`classroom-runtime flex min-w-0 max-w-full flex-col overflow-hidden ${variant === "preview" ? "h-full" : "h-dvh"}`}
		>
			<ClassroomHeader
				title={event.title}
				current={state.currentStageIndex + 1}
				total={state.routeStages.length}
				seconds={stage.suggestedSeconds}
				onStop={onStop}
			/>
			<div
				ref={stageRegion}
				data-classroom-stage-region
				data-scrollable-hint={visualStage ? "" : undefined}
				tabIndex={-1}
				aria-live="polite"
				className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2 text-center touch-pan-y sm:px-6"
				onTouchStart={gestures.onTouchStart}
				onTouchMove={gestures.onTouchMove}
				onTouchEnd={gestures.onTouchEnd}
			>
				<div
					key={routeStage.id}
					data-classroom-stage-frame
					data-transition-direction={transitionDirection}
					className={`flex h-full min-h-full min-w-0 max-w-full w-full justify-center motion-reduce:animate-none ${
						visualStage
							? "items-stretch"
							: sourceComparisonStage
								? "items-start"
								: "items-center"
					} ${
						transitionDirection === "back"
							? "animate-[classroom-stage-back_280ms_cubic-bezier(0.22,1,0.36,1)_both]"
							: "animate-[classroom-stage-forward_280ms_cubic-bezier(0.22,1,0.36,1)_both]"
					} [@media(max-height:24rem)]:h-auto [@media(max-height:24rem)]:min-h-max [@media(max-height:24rem)]:items-start`}
				>
					<BeatStagePanel
						beat={event.beat}
						stage={stage}
						sources={event.sources}
						visual={stageVisual}
					/>
				</div>
				{hasMoreContent ? (
					<p
						data-classroom-scroll-hint
						className="pointer-events-none sticky right-2 bottom-2 ml-auto -mt-9 mr-2 w-fit rounded-full border border-ink/15 bg-paper/95 px-3 py-1 font-bold text-ink/75 text-xs shadow-sm"
					>
						{messages.beat.scrollForMore}
					</p>
				) : null}
			</div>
			<ClassroomFooter
				stage={stage}
				routeOptional={routeStage.optional}
				canGoBack={state.currentStageIndex > 0}
				nextLabel={nextLabel}
				dispatch={dispatch}
				variant={variant}
			/>
		</main>
	);
}

function ClassroomHeader({
	title,
	current,
	total,
	seconds,
	onStop,
}: {
	title: string;
	current: number;
	total: number;
	seconds: number;
	onStop?: () => void;
}) {
	return (
		<header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 border-ink/15 border-b px-3 py-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-3 sm:px-5">
			<h1
				data-classroom-event-title
				className="min-w-0 text-balance font-bold text-sm leading-4 sm:text-base sm:leading-5"
			>
				{title}
			</h1>
			<p className="col-start-1 row-start-2 min-w-0 text-ink/60 text-xs sm:col-start-2 sm:row-start-1 sm:text-sm">
				<span data-classroom-progress>
					Stap {current} van {total}
				</span>{" "}
				<span aria-hidden="true">·</span>{" "}
				<span data-stage-timing>
					{messages.beat.suggestedTime} {seconds} sec.
				</span>
			</p>
			<button
				type="button"
				aria-label={messages.beat.controls.close}
				title={messages.beat.controls.close}
				className="compact-button col-start-2 row-span-2 row-start-1 size-12 shrink-0 rounded-full text-ink/70 hover:bg-ink/10 hover:text-ink sm:col-start-3 sm:row-span-1"
				onClick={onStop}
			>
				<svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
					<path
						d="M6 6l12 12M18 6 6 18"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeWidth="2"
					/>
				</svg>
			</button>
		</header>
	);
}

function ClassroomFooter({
	stage,
	routeOptional,
	canGoBack,
	nextLabel,
	dispatch,
}: {
	stage: BeatPlayerEvent["beat"]["stages"][number];
	routeOptional: boolean;
	canGoBack: boolean;
	nextLabel: string;
	dispatch: Dispatch<BeatRuntimeAction>;
	variant?: BeatPlayerVariant;
}) {
	const buttonColumns = routeOptional ? "grid-cols-4" : "grid-cols-3";
	return (
		<footer className="shrink-0 border-ink/15 border-t bg-paper px-2 py-2 sm:px-5 sm:py-3">
			<div className="grid gap-x-3 gap-y-1 text-pretty text-ink/70 text-xs sm:grid-cols-2 sm:text-sm min-[80rem]:text-base">
				<p data-teacher-cue>
					<strong className="text-ink">{messages.beat.teacherCue}:</strong>{" "}
					{stage.teacherPrompt}
				</p>
				<p data-student-action className="sm:text-right">
					<strong className="text-ink">{messages.beat.studentAction}:</strong>{" "}
					{stage.expectedStudentAction}
				</p>
			</div>
			<div
				className={`mt-2 grid items-center gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] sm:gap-3 ${buttonColumns}`}
			>
				<button
					type="button"
					className="secondary-button min-w-0 px-2 sm:px-4"
					disabled={!canGoBack}
					onClick={() => dispatch({ type: "back" })}
				>
					{messages.beat.controls.back}
				</button>
				{routeOptional ? (
					<button
						type="button"
						className="secondary-button min-w-0 px-2 sm:px-4"
						onClick={() => dispatch({ type: "skip" })}
					>
						{messages.beat.controls.skip}
					</button>
				) : null}
				<button
					type="button"
					className="text-button min-w-0 px-2 sm:col-start-4 sm:px-3"
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
						className="primary-button min-w-0 px-2 sm:col-start-5 sm:px-4"
						onClick={() => dispatch({ type: "finish" })}
					>
						{messages.beat.controls.finish}
					</button>
				) : (
					<button
						type="button"
						className="primary-button min-w-0 px-2 sm:col-start-5 sm:px-4"
						onClick={(event) => {
							if (event.detail > 1) return;
							dispatch({ type: "advance" });
						}}
					>
						{nextLabel}
					</button>
				)}
			</div>
		</footer>
	);
}
