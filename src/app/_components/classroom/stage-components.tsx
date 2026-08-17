import type { ReactNode } from "react";
import { HistoricalVisualFigure } from "@/app/_components/historical-visual";
import type { InteractiveBeat } from "@/lib/content/event";
import type { Event } from "@/lib/content/event-document";
import type { HistoricalVisual } from "@/lib/content/event-media";
import { messages } from "@/lib/i18n/messages.nl-BE";

const eyebrowClassName =
	"font-bold text-accent text-xs uppercase tracking-[0.18em] sm:text-sm";
const headingClassName =
	"mt-3 text-balance font-serif text-[clamp(2rem,5vw,5.5rem)] font-medium leading-[0.95]";
const visualHeadingClassName =
	"mt-3 text-balance font-serif text-[clamp(1.75rem,5vw,5.5rem)] font-medium leading-[0.95] [@media(max-height:48rem)]:text-[clamp(1.75rem,4.5vw,4.25rem)] [@media(max-height:40rem)]:mt-1 [@media(max-height:40rem)]:text-[clamp(1.75rem,4.4vw,3.75rem)]";
const compositionClassName =
	"mx-auto flex w-full max-w-6xl -translate-y-[clamp(0rem,3vh,2rem)] flex-col items-center";

type BeatStage = InteractiveBeat["stages"][number];

type BeatStagePanelProps = {
	beat: InteractiveBeat;
	stage: BeatStage;
	sources: Event["sources"];
	visual?: HistoricalVisual | null;
};

type StageShellProps = {
	children: ReactNode;
	mechanic?: InteractiveBeat["mechanic"];
	phase: BeatStage["phase"];
	visual?: HistoricalVisual | null;
};

function StageShell({ children, mechanic, phase, visual }: StageShellProps) {
	return (
		<article
			data-beat-phase={phase}
			data-beat-mechanic={mechanic}
			data-stage-visual-layout={visual ? "" : undefined}
			className={`[&_cite]:[overflow-wrap:anywhere] [&_h2]:[overflow-wrap:anywhere] [&_li]:[overflow-wrap:anywhere] [&_p]:[overflow-wrap:anywhere] ${
				visual
					? "classroom-stage--visual classroom-visual-stage relative isolate grid h-full min-h-0 w-full min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg bg-ink text-white shadow-[0_24px_80px_rgb(33_31_26_/_18%)] [@media(max-height:24rem)]:min-h-[19rem]"
					: "relative isolate w-full min-w-0"
			}`}
		>
			{visual ? <ClassroomVisual visual={visual} /> : null}
			{children}
		</article>
	);
}

function ClassroomVisual({ visual }: { visual: HistoricalVisual }) {
	return (
		<div data-classroom-visual className="classroom-stage-visual contents">
			<HistoricalVisualFigure
				visual={visual}
				showCaption={false}
				className="contents"
				imageClassName="absolute inset-0 -z-20 h-full w-full object-cover"
				captionClassName="relative z-10 row-start-2 justify-end px-3 pb-2 text-right text-xs leading-5 text-white/90 sm:px-4 sm:pb-3 sm:text-sm min-[80rem]:text-base [@media(max-height:40rem)]:min-h-11 [@media(max-height:40rem)]:pb-0 [@media(max-height:40rem)]:text-[0.6875rem] [@media(max-height:40rem)]:leading-3"
			/>
		</div>
	);
}

function StageContent({ children }: { children: ReactNode }) {
	return (
		<div
			data-stage-visual-content
			className="relative z-10 row-start-1 min-w-0 p-3 text-left sm:p-[clamp(1.25rem,2.5vw,2.5rem)] [@media(max-height:48rem)]:py-1"
		>
			{children}
		</div>
	);
}

function TextStageComposition({ children }: { children: ReactNode }) {
	return (
		<div
			data-stage-composition
			className={`${compositionClassName} [@media(max-height:32rem)]:translate-y-0`}
		>
			{children}
		</div>
	);
}

function StageEyebrow({ children }: { children: ReactNode }) {
	return (
		<p data-stage-eyebrow className={eyebrowClassName}>
			{children}
		</p>
	);
}

function StageHeading({
	children,
	visual = false,
}: {
	children: ReactNode;
	visual?: boolean;
}) {
	return (
		<h2 className={visual ? visualHeadingClassName : headingClassName}>
			{children}
		</h2>
	);
}

export function BeatStagePanel({
	beat,
	stage,
	sources,
	visual,
}: BeatStagePanelProps) {
	if (stage.phase === "opening") {
		return (
			<StageShell phase={stage.phase} mechanic={beat.mechanic} visual={visual}>
				{visual ? (
					<StageContent>
						<StageEyebrow>{messages.beat.phases.opening}</StageEyebrow>
						<StageHeading visual>{beat.question}</StageHeading>
						<StageBody visual>{stage.stimulus}</StageBody>
						{beat.mechanic === "context-decision" ? (
							<ContextDecision perspective={beat.perspective} visual />
						) : null}
						{beat.mechanic === "vote-revote" ? (
							<BeatChoices beat={beat} visual />
						) : null}
					</StageContent>
				) : (
					<TextStageComposition>
						<StageEyebrow>{messages.beat.phases.opening}</StageEyebrow>
						<StageHeading>{beat.question}</StageHeading>
						<StageBody>{stage.stimulus}</StageBody>
						{beat.mechanic === "source-duel" ? (
							<SourceComparison beat={beat} sources={sources} />
						) : null}
						{beat.mechanic === "context-decision" ? (
							<ContextDecision perspective={beat.perspective} />
						) : null}
						{beat.mechanic === "vote-revote" ? (
							<BeatChoices beat={beat} />
						) : null}
					</TextStageComposition>
				)}
			</StageShell>
		);
	}

	if (stage.phase === "commitment" || stage.phase === "revision") {
		return (
			<StageShell phase={stage.phase}>
				<TextStageComposition>
					<StageEyebrow>{messages.beat.phases[stage.phase]}</StageEyebrow>
					<StageHeading>{stage.prompt}</StageHeading>
					<BeatChoices beat={beat} />
				</TextStageComposition>
			</StageShell>
		);
	}

	if (stage.phase === "discussion" || stage.phase === "reasoning") {
		return (
			<StageShell phase={stage.phase}>
				<TextStageComposition>
					<StageEyebrow>{messages.beat.phases[stage.phase]}</StageEyebrow>
					<StageHeading>{stage.prompt}</StageHeading>
				</TextStageComposition>
			</StageShell>
		);
	}

	if (stage.phase === "resolution") {
		const resolutionSources = sources.filter(({ url }) =>
			stage.sourceUrls.includes(url),
		);
		return (
			<StageShell phase={stage.phase} visual={visual}>
				{visual ? (
					<StageContent>
						<StageEyebrow>{messages.beat.phases.resolution}</StageEyebrow>
						<StageHeading visual>{stage.title}</StageHeading>
						<StageBody visual>{stage.feedback}</StageBody>
						{stage.misconception ? (
							<ResolutionCallout>{stage.misconception}</ResolutionCallout>
						) : null}
						<StageSource visual>{formatSources(resolutionSources)}</StageSource>
					</StageContent>
				) : (
					<TextStageComposition>
						<StageEyebrow>{messages.beat.phases.resolution}</StageEyebrow>
						<StageHeading>{stage.title}</StageHeading>
						<StageBody>{stage.feedback}</StageBody>
						{stage.misconception ? (
							<ResolutionCallout>{stage.misconception}</ResolutionCallout>
						) : null}
						<StageSource>{formatSources(resolutionSources)}</StageSource>
					</TextStageComposition>
				)}
			</StageShell>
		);
	}

	if (stage.phase === "lesson-bridge") {
		return (
			<StageShell phase={stage.phase}>
				<TextStageComposition>
					<StageEyebrow>{messages.beat.phases.lessonBridge}</StageEyebrow>
					<StageHeading>{stage.bridge}</StageHeading>
					{beat.version === 2 && beat.vocationalConnection ? (
						<p className="mx-auto mt-6 max-w-4xl rounded-md border border-ink/20 bg-white px-5 py-4 text-[clamp(1rem,1.6vw,1.4rem)] text-ink">
							{beat.vocationalConnection}
						</p>
					) : null}
				</TextStageComposition>
			</StageShell>
		);
	}

	if (stage.phase === "evidence") {
		const source = sources.find(({ url }) => url === stage.sourceUrl);
		return (
			<StageShell phase={stage.phase} visual={visual}>
				{visual ? (
					<StageContent>
						<StageEyebrow>{messages.beat.phases.evidence}</StageEyebrow>
						<StageHeading visual>{stage.title}</StageHeading>
						<StageBody visual emphasized>
							{stage.evidence}
						</StageBody>
						{source ? (
							<StageSource visual>
								{source.title} · {source.publisher}
							</StageSource>
						) : null}
					</StageContent>
				) : (
					<TextStageComposition>
						<StageEyebrow>{messages.beat.phases.evidence}</StageEyebrow>
						<StageHeading>{stage.title}</StageHeading>
						<StageBody emphasized>{stage.evidence}</StageBody>
						{source ? (
							<StageSource>
								{source.title} · {source.publisher}
							</StageSource>
						) : null}
					</TextStageComposition>
				)}
			</StageShell>
		);
	}

	return null;
}

function StageBody({
	children,
	emphasized = false,
	visual = false,
}: {
	children: ReactNode;
	emphasized?: boolean;
	visual?: boolean;
}) {
	return (
		<p
			className={`classroom-stage-body mx-auto max-w-5xl text-balance leading-tight ${
				emphasized
					? "mt-6 text-[clamp(1.4rem,3vw,3rem)]"
					: "mt-4 text-[clamp(1.1rem,2.4vw,2.4rem)] sm:mt-6 [@media(max-height:40rem)]:mt-2 [@media(max-height:40rem)]:text-base [@media(max-height:40rem)]:leading-[1.05]"
			} ${visual ? "mx-0" : ""}`}
		>
			{children}
		</p>
	);
}

function ContextDecision({
	perspective,
	visual = false,
}: {
	perspective: string;
	visual?: boolean;
}) {
	return (
		<p
			data-beat-perspective
			className={`mx-auto mt-5 max-w-4xl rounded-md border px-5 py-3 text-[clamp(1rem,1.7vw,1.4rem)] leading-snug sm:mt-6 sm:px-6 sm:py-4 ${
				visual
					? "border-white/35 bg-ink/65 text-white"
					: "border-ink/20 bg-white text-ink"
			}`}
		>
			{perspective}
		</p>
	);
}

function SourceComparison({
	beat,
	sources,
}: {
	beat: Extract<InteractiveBeat, { mechanic: "source-duel" }>;
	sources: Event["sources"];
}) {
	return (
		<ul className="mx-auto mt-5 grid w-full max-w-full grid-cols-1 gap-3 overflow-x-hidden text-left min-[40rem]:grid-cols-2 sm:mt-6 sm:max-w-6xl sm:gap-4 [@media(max-height:32rem)]:mt-1 [@media(max-height:32rem)]:gap-2">
			{beat.sourceCards.map((card) => {
				const source = sources.find(({ url }) => url === card.sourceUrl);
				return (
					<li
						key={card.id}
						data-source-card=""
						className="flex min-w-0 max-w-full flex-col overflow-x-hidden rounded-md border border-ink/25 bg-white px-4 py-3 text-ink sm:px-5 sm:py-4 [@media(max-height:32rem)]:px-3 [@media(max-height:32rem)]:py-2"
					>
						<p className="font-bold text-accent text-base uppercase tracking-[0.08em] sm:tracking-[0.12em] [@media(max-height:32rem)]:text-sm">
							{card.label}
						</p>
						<p
							data-source-excerpt
							className="mt-2 break-words text-[clamp(1rem,1.7vw,1.4rem)] leading-snug [@media(max-height:32rem)]:mt-1 [@media(max-height:32rem)]:leading-[1.05]"
						>
							{card.excerpt}
						</p>
						{source ? (
							<p
								data-source-citation
								className="classroom-source-card-citation mt-3 break-words font-bold text-ink/60 text-xs uppercase leading-4 tracking-[0.04em] sm:text-sm sm:leading-5 sm:tracking-[0.08em] min-[80rem]:text-base [@media(max-height:32rem)]:mt-1 [@media(max-height:32rem)]:text-xs [@media(max-height:32rem)]:leading-3"
								title={`${source.title} · ${source.publisher}`}
							>
								<cite className="[overflow-wrap:anywhere] not-italic">
									{source.title}
								</cite>{" "}
								· {source.publisher}
							</p>
						) : null}
					</li>
				);
			})}
		</ul>
	);
}

function BeatChoices({
	beat,
	visual = false,
}: {
	beat: InteractiveBeat;
	visual?: boolean;
}) {
	const columns =
		beat.choices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
	return (
		<ul
			data-choice-count={beat.choices.length}
			className={`mx-auto mt-6 grid w-full max-w-6xl auto-rows-fr grid-cols-1 gap-2 sm:mt-8 sm:gap-4 [@media(max-height:40rem)]:mt-2 ${columns} ${
				beat.choices.length === 4
					? "[@media(min-width:64rem)_and_(min-aspect-ratio:3/2)]:grid-cols-4"
					: ""
			}`}
		>
			{beat.choices.map((choice) => (
				<li
					key={choice.id}
					data-beat-choice
					className={`flex min-h-14 min-w-0 items-center justify-center rounded-md border px-3 py-3 text-center font-bold text-[clamp(1rem,1.8vw,1.5rem)] sm:min-h-17 sm:px-5 sm:py-4 [@media(max-height:40rem)]:min-h-12 [@media(max-height:40rem)]:py-1 ${
						visual
							? "border-white/40 bg-ink/70 text-white shadow-[inset_0_1px_rgb(255_255_255_/_10%)]"
							: "border-ink/30 bg-white/55 text-ink"
					}`}
				>
					{choice.label}
				</li>
			))}
		</ul>
	);
}

function ResolutionCallout({ children }: { children: ReactNode }) {
	return (
		<p
			data-resolution-support
			className="mx-auto mt-5 max-w-4xl rounded-md border border-white/35 bg-ink/65 px-5 py-4 text-[clamp(1rem,1.6vw,1.4rem)] text-white"
		>
			{children}
		</p>
	);
}

function StageSource({
	children,
	visual = false,
}: {
	children: ReactNode;
	visual?: boolean;
}) {
	return (
		<p
			className={`classroom-stage-source mt-5 break-words font-bold text-xs uppercase leading-4 tracking-[0.06em] sm:text-sm sm:leading-5 sm:tracking-[0.1em] min-[80rem]:text-base ${
				visual ? "text-white/85" : "text-ink/70"
			}`}
		>
			{children}
		</p>
	);
}

function formatSources(sources: Event["sources"]) {
	return sources
		.map(({ title, publisher }) => `${title} · ${publisher}`)
		.join(" | ");
}
