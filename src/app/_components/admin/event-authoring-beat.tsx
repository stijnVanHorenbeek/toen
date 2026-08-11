"use client";

import type {
	AuthoringBeatDraft,
	AuthoringBeatStage,
} from "@/lib/admin/authoring-beat";
import { beatResponseMethods } from "@/lib/content/event";
import { formatStep } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { useEventAuthoring } from "./event-authoring-context";
import {
	ErrorSummary,
	Field,
	FieldError,
	inputClass,
	StageActions,
	StageHeader,
} from "./event-authoring-fields";

const textareaClass = `${inputClass} resize-y py-3`;

export function ActivityStage() {
	const { state, actions } = useEventAuthoring();
	const beat = state.draft.beat;
	return (
		<section aria-labelledby="activity-stage-title" className="authoring-panel">
			<StageHeader
				step={formatStep(3, 4)}
				title={messages.admin.steps[2]}
				id="activity-stage-title"
			>
				{messages.admin.activityIntro}
			</StageHeader>
			<ErrorSummary errors={state.errors} />
			{state.previewError ? (
				<p
					role="alert"
					className="mb-8 rounded-md border border-accent bg-white p-4 font-semibold text-accent"
				>
					{state.previewError}
				</p>
			) : null}
			<fieldset>
				<legend className="font-serif text-2xl font-semibold">
					{messages.admin.fields.activityKind}
				</legend>
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					<ActivityKindChoice
						checked={!beat}
						label={messages.admin.fields.articleOnly}
						onChange={() => {
							if (
								!beat ||
								window.confirm(messages.admin.removeActivityConfirm)
							) {
								actions.disableBeat();
							}
						}}
					/>
					<ActivityKindChoice
						checked={Boolean(beat)}
						label={messages.admin.fields.withActivity}
						onChange={actions.enableBeat}
					/>
				</div>
			</fieldset>
			{beat ? <BeatFields beat={beat} /> : null}
			<StageActions>
				<button
					type="button"
					onClick={() => actions.goToStep(2)}
					className="text-button"
				>
					{messages.admin.actions.backClassification}
				</button>
				<button
					type="button"
					disabled={state.isPreviewing}
					onClick={() => void actions.requestPreview()}
					className="primary-button"
				>
					{state.isPreviewing
						? messages.admin.actions.previewing
						: messages.admin.actions.preview}
				</button>
			</StageActions>
		</section>
	);
}

function ActivityKindChoice({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: () => void;
}) {
	return (
		<label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-ink/40 bg-white px-4">
			<input
				type="radio"
				name="activity-kind"
				checked={checked}
				onChange={onChange}
				className="size-5 accent-accent"
			/>
			{label}
		</label>
	);
}

function BeatFields({ beat }: { beat: AuthoringBeatDraft }) {
	const { state, actions } = useEventAuthoring();
	const update = (next: AuthoringBeatDraft) => actions.updateBeat(next);
	const updateField = <Key extends keyof AuthoringBeatDraft>(
		field: Key,
		value: AuthoringBeatDraft[Key],
	) => update({ ...beat, [field]: value });
	return (
		<div className="mt-10 space-y-10 border-ink/20 border-t pt-8">
			<div className="grid gap-5 sm:grid-cols-2">
				<Field
					label={messages.admin.fields.mechanic}
					name="beat.mechanic"
					error={state.errors["beat.mechanic"]}
				>
					<select
						id="beat.mechanic"
						value={beat.mechanic}
						onChange={(event) =>
							updateField(
								"mechanic",
								event.target.value as AuthoringBeatDraft["mechanic"],
							)
						}
						className={inputClass}
					>
						{Object.entries(messages.admin.fields.mechanicOptions).map(
							([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							),
						)}
					</select>
				</Field>
				<Field
					label={messages.admin.fields.responseMethod}
					name="beat.responseMethod"
					error={state.errors["beat.responseMethod"]}
				>
					<select
						id="beat.responseMethod"
						value={beat.responseMethod}
						onChange={(event) =>
							updateField(
								"responseMethod",
								event.target.value as AuthoringBeatDraft["responseMethod"],
							)
						}
						className={inputClass}
					>
						{beatResponseMethods.map((method) => (
							<option key={method} value={method}>
								{messages.admin.fields.responseMethods[method]}
							</option>
						))}
					</select>
				</Field>
			</div>
			<Field
				label={messages.admin.fields.activityQuestion}
				name="beat.question"
				error={state.errors["beat.question"]}
			>
				<textarea
					id="beat.question"
					rows={2}
					maxLength={240}
					value={beat.question}
					onChange={(event) => updateField("question", event.target.value)}
					className={textareaClass}
				/>
			</Field>
			<ChoicesFields beat={beat} update={update} />
			{beat.mechanic === "context-decision" ? (
				<Field
					label={messages.admin.fields.perspective}
					name="beat.perspective"
					error={state.errors["beat.perspective"]}
				>
					<textarea
						id="beat.perspective"
						rows={3}
						maxLength={400}
						value={beat.perspective}
						onChange={(event) => updateField("perspective", event.target.value)}
						className={textareaClass}
					/>
				</Field>
			) : null}
			{beat.mechanic === "source-duel" ? (
				<SourceCardFields beat={beat} update={update} />
			) : null}
			<section aria-labelledby="activity-sequence-title">
				<h3
					id="activity-sequence-title"
					className="font-serif text-2xl font-semibold"
				>
					Vaste lesfasen
				</h3>
				<p className="mt-2 text-ink/70 text-sm">
					De volgorde en duurkeuzes van 5, 8 en 12 minuten worden automatisch
					opgebouwd.
				</p>
				<RouteTotals beat={beat} />
				<div className="mt-5 space-y-5">
					{beat.stages.map((stage, index) => (
						<StageFields
							key={stage.id}
							beat={beat}
							stage={stage}
							index={index}
							update={update}
						/>
					))}
				</div>
			</section>
			<Field
				label={messages.admin.fields.vocationalConnection}
				name="beat.vocationalConnection"
				error={state.errors["beat.vocationalConnection"]}
				hint={messages.admin.fields.vocationalConnectionHint}
			>
				<textarea
					id="beat.vocationalConnection"
					rows={3}
					maxLength={240}
					value={beat.vocationalConnection}
					onChange={(event) =>
						updateField("vocationalConnection", event.target.value)
					}
					className={textareaClass}
				/>
			</Field>
			<Field
				label={messages.admin.fields.sensitivityNote}
				name="beat.sensitivityNotes.0"
				error={state.errors["beat.sensitivityNotes.0"]}
			>
				<textarea
					id="beat.sensitivityNotes.0"
					rows={2}
					maxLength={300}
					value={beat.sensitivityNotes[0] ?? ""}
					onChange={(event) =>
						updateField(
							"sensitivityNotes",
							event.target.value ? [event.target.value] : [],
						)
					}
					className={textareaClass}
				/>
			</Field>
		</div>
	);
}

function ChoicesFields({
	beat,
	update,
}: {
	beat: AuthoringBeatDraft;
	update: (beat: AuthoringBeatDraft) => void;
}) {
	const { state } = useEventAuthoring();
	return (
		<fieldset>
			<legend className="font-serif text-xl font-semibold">
				Antwoordkeuzes
			</legend>
			<div className="mt-4 grid gap-4 sm:grid-cols-2">
				{beat.choices.map((choice, index) => {
					const name = `beat.choices.${index}.label`;
					return (
						<div
							key={choice.id}
							className="rounded-md border border-ink/20 bg-white p-4"
						>
							<Field
								label={`${messages.admin.fields.choice} ${index + 1}`}
								name={name}
								error={state.errors[name]}
							>
								<input
									id={name}
									maxLength={80}
									value={choice.label}
									onChange={(event) =>
										update({
											...beat,
											choices: beat.choices.map((item, choiceIndex) =>
												choiceIndex === index
													? { ...item, label: event.target.value }
													: item,
											),
										})
									}
									className={inputClass}
								/>
							</Field>
							{beat.choices.length > 2 ? (
								<button
									type="button"
									onClick={() =>
										update({
											...beat,
											choices: beat.choices.filter(
												(_, choiceIndex) => choiceIndex !== index,
											),
										})
									}
									className="small-button mt-3"
								>
									{messages.admin.actions.remove}
								</button>
							) : null}
						</div>
					);
				})}
			</div>
			{beat.choices.length < 4 ? (
				<button
					type="button"
					onClick={() =>
						update({
							...beat,
							choices: [...beat.choices, { id: nextChoiceId(beat), label: "" }],
						})
					}
					className="secondary-button mt-4"
				>
					{messages.admin.actions.addChoice}
				</button>
			) : null}
		</fieldset>
	);
}

function SourceCardFields({
	beat,
	update,
}: {
	beat: AuthoringBeatDraft;
	update: (beat: AuthoringBeatDraft) => void;
}) {
	const { state } = useEventAuthoring();
	return (
		<fieldset
			id="beat.sourceCards"
			tabIndex={-1}
			aria-invalid={state.errors["beat.sourceCards"] ? "true" : undefined}
			aria-describedby={
				state.errors["beat.sourceCards"] ? "beat.sourceCards-error" : undefined
			}
		>
			<legend className="font-serif text-xl font-semibold">
				{messages.admin.fields.sourceCards}
			</legend>
			<div className="mt-4 grid gap-4 sm:grid-cols-2">
				{beat.sourceCards.map((card, index) => (
					<div
						key={card.id}
						className="space-y-4 rounded-md border border-ink/20 bg-white p-4"
					>
						<BeatTextInput
							name={`beat.sourceCards.${index}.label`}
							label={`${messages.admin.fields.choice} ${index + 1}`}
							value={card.label}
							maxLength={80}
							onChange={(value) =>
								updateSourceCard(beat, index, { label: value }, update)
							}
						/>
						<BeatTextArea
							name={`beat.sourceCards.${index}.excerpt`}
							label={messages.admin.fields.sourceExcerpt}
							value={card.excerpt}
							maxLength={400}
							onChange={(value) =>
								updateSourceCard(beat, index, { excerpt: value }, update)
							}
						/>
						<SourceSelect
							name={`beat.sourceCards.${index}.sourceId`}
							value={card.sourceId}
							onChange={(sourceId) =>
								updateSourceCard(beat, index, { sourceId }, update)
							}
							error={state.errors[`beat.sourceCards.${index}.sourceId`]}
						/>
					</div>
				))}
			</div>
			<FieldError
				id="beat.sourceCards"
				error={state.errors["beat.sourceCards"]}
			/>
		</fieldset>
	);
}

function StageFields({
	beat,
	stage,
	index,
	update,
}: {
	beat: AuthoringBeatDraft;
	stage: AuthoringBeatStage;
	index: number;
	update: (beat: AuthoringBeatDraft) => void;
}) {
	const { state } = useEventAuthoring();
	const path = `beat.stages.${index}`;
	const change = (patch: Partial<AuthoringBeatStage>) => {
		const stages = beat.stages.map((current, stageIndex) =>
			stageIndex === index
				? ({ ...current, ...patch } as AuthoringBeatStage)
				: current,
		);
		update({ ...beat, stages });
	};
	const changeDurationRoute = (duration: 8 | 12) => {
		if (stage.phase !== "evidence") return;
		const discussionId = stage.id.replace("evidence", "discussion");
		const stages = beat.stages.map((current) =>
			current.id === stage.id || current.id === discussionId
				? ({
						...current,
						earliestDurationMinutes: duration,
					} as AuthoringBeatStage)
				: current,
		);
		update({ ...beat, stages });
	};
	return (
		<section
			id={path}
			aria-labelledby={`${path}.heading`}
			className="rounded-md border border-ink/25 bg-white p-5"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<h4 id={`${path}.heading`} className="font-serif text-xl font-semibold">
					{stageLabel(stage)}
				</h4>
				{stageTier(stage) ? (
					<p className="font-semibold text-accent text-xs uppercase tracking-wider">
						Vanaf {stageTier(stage)} minuten
					</p>
				) : null}
			</div>
			<div className="mt-5 space-y-5">
				{stage.phase === "evidence" && stage.earliestDurationMinutes > 5 ? (
					<Field
						label={messages.admin.fields.durationRoute}
						name={`${path}.earliestDurationMinutes`}
						error={state.errors[`${path}.earliestDurationMinutes`]}
					>
						<select
							id={`${path}.earliestDurationMinutes`}
							value={stage.earliestDurationMinutes}
							onChange={(event) =>
								changeDurationRoute(Number(event.target.value) as 8 | 12)
							}
							className={inputClass}
						>
							<option value={8}>Vanaf 8 minuten</option>
							<option value={12}>Vanaf 12 minuten</option>
						</select>
					</Field>
				) : null}
				<StageContentFields stage={stage} path={path} change={change} />
				<div className="grid gap-5 sm:grid-cols-2">
					<BeatTextArea
						name={`${path}.teacherPrompt`}
						label={messages.admin.fields.teacherPrompt}
						value={stage.teacherPrompt}
						maxLength={240}
						onChange={(teacherPrompt) => change({ teacherPrompt })}
					/>
					<BeatTextArea
						name={`${path}.expectedStudentAction`}
						label={messages.admin.fields.expectedStudentAction}
						value={stage.expectedStudentAction}
						maxLength={160}
						onChange={(expectedStudentAction) =>
							change({ expectedStudentAction })
						}
					/>
				</div>
				<Field
					label={messages.admin.fields.suggestedSeconds}
					name={`${path}.suggestedSeconds`}
					error={state.errors[`${path}.suggestedSeconds`]}
				>
					<input
						id={`${path}.suggestedSeconds`}
						type="number"
						min={
							stage.phase === "opening" || stage.phase === "commitment" ? 1 : 30
						}
						max={
							stage.phase === "opening" || stage.phase === "commitment"
								? 30
								: 90
						}
						value={stage.suggestedSeconds}
						onChange={(event) =>
							change({ suggestedSeconds: event.target.value })
						}
						className={inputClass}
					/>
				</Field>
			</div>
		</section>
	);
}

function StageContentFields({
	stage,
	path,
	change,
}: {
	stage: AuthoringBeatStage;
	path: string;
	change: (patch: Partial<AuthoringBeatStage>) => void;
}) {
	const { state } = useEventAuthoring();
	if (stage.phase === "opening")
		return (
			<BeatTextArea
				name={`${path}.stimulus`}
				label={messages.admin.fields.projectedContent}
				value={stage.stimulus}
				maxLength={400}
				onChange={(stimulus) => change({ stimulus })}
			/>
		);
	if (
		stage.phase === "commitment" ||
		stage.phase === "revision" ||
		stage.phase === "reasoning"
	)
		return (
			<BeatTextArea
				name={`${path}.prompt`}
				label={messages.admin.fields.projectedContent}
				value={stage.prompt}
				maxLength={240}
				onChange={(prompt) => change({ prompt })}
			/>
		);
	if (stage.phase === "discussion")
		return (
			<div className="grid gap-5 sm:grid-cols-2">
				<BeatTextArea
					name={`${path}.prompt`}
					label={messages.admin.fields.discussionPrompt}
					value={stage.prompt}
					maxLength={240}
					onChange={(prompt) => change({ prompt })}
				/>
				<BeatTextInput
					name={`${path}.sentenceStarter`}
					label={messages.admin.fields.sentenceStarter}
					value={stage.sentenceStarter}
					maxLength={120}
					onChange={(sentenceStarter) => change({ sentenceStarter })}
				/>
			</div>
		);
	if (stage.phase === "evidence")
		return (
			<div className="space-y-5">
				<BeatTextInput
					name={`${path}.title`}
					label={messages.admin.fields.evidenceTitle}
					value={stage.title}
					maxLength={80}
					onChange={(title) => change({ title })}
				/>
				<BeatTextArea
					name={`${path}.evidence`}
					label={messages.admin.fields.evidence}
					value={stage.evidence}
					maxLength={400}
					onChange={(evidence) => change({ evidence })}
				/>
				<SourceSelect
					name={`${path}.sourceId`}
					value={stage.sourceId}
					onChange={(sourceId) => change({ sourceId })}
					error={state.errors[`${path}.sourceId`]}
				/>
			</div>
		);
	if (stage.phase === "resolution")
		return (
			<div className="space-y-5">
				<BeatTextInput
					name={`${path}.title`}
					label={messages.admin.fields.evidenceTitle}
					value={stage.title}
					maxLength={80}
					onChange={(title) => change({ title })}
				/>
				<BeatTextArea
					name={`${path}.feedback`}
					label={messages.admin.fields.feedback}
					value={stage.feedback}
					maxLength={400}
					onChange={(feedback) => change({ feedback })}
				/>
				<BeatTextArea
					name={`${path}.misconception`}
					label={messages.admin.fields.misconception}
					value={stage.misconception}
					maxLength={240}
					onChange={(misconception) => change({ misconception })}
				/>
				<ResolutionSources
					name={`${path}.sourceIds`}
					selected={stage.sourceIds}
					onChange={(sourceIds) => change({ sourceIds })}
				/>
			</div>
		);
	return (
		<BeatTextArea
			name={`${path}.bridge`}
			label={messages.admin.fields.lessonBridge}
			value={stage.bridge}
			maxLength={400}
			onChange={(bridge) => change({ bridge })}
		/>
	);
}

function BeatTextInput({
	name,
	label,
	value,
	maxLength,
	onChange,
}: {
	name: string;
	label: string;
	value: string;
	maxLength: number;
	onChange: (value: string) => void;
}) {
	const error = useEventAuthoring().state.errors[name];
	return (
		<Field label={label} name={name} error={error}>
			<input
				id={name}
				value={value}
				maxLength={maxLength}
				onChange={(event) => onChange(event.target.value)}
				aria-invalid={error ? "true" : undefined}
				className={inputClass}
			/>
		</Field>
	);
}

function BeatTextArea({
	name,
	label,
	value,
	maxLength,
	onChange,
}: {
	name: string;
	label: string;
	value: string;
	maxLength: number;
	onChange: (value: string) => void;
}) {
	const error = useEventAuthoring().state.errors[name];
	return (
		<Field label={label} name={name} error={error}>
			<textarea
				id={name}
				rows={3}
				value={value}
				maxLength={maxLength}
				onChange={(event) => onChange(event.target.value)}
				aria-invalid={error ? "true" : undefined}
				className={textareaClass}
			/>
		</Field>
	);
}

function SourceSelect({
	name,
	value,
	onChange,
	error,
}: {
	name: string;
	value: string;
	onChange: (value: string) => void;
	error?: string;
}) {
	const { state } = useEventAuthoring();
	return (
		<Field
			label={messages.admin.fields.activitySource}
			name={name}
			error={error}
		>
			<select
				id={name}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className={inputClass}
			>
				<option value="">{messages.admin.fields.chooseSource}</option>
				{state.draft.sources.map((source, index) => (
					<option key={source.id ?? index} value={source.id}>
						{source.title || `Bron ${index + 1}`}
					</option>
				))}
			</select>
		</Field>
	);
}

function ResolutionSources({
	name,
	selected,
	onChange,
}: {
	name: string;
	selected: string[];
	onChange: (value: string[]) => void;
}) {
	const { state } = useEventAuthoring();
	return (
		<fieldset
			id={name}
			tabIndex={-1}
			aria-invalid={state.errors[name] ? "true" : undefined}
			aria-describedby={state.errors[name] ? `${name}-error` : undefined}
		>
			<legend className="font-semibold">
				{messages.admin.fields.resolutionSources}
			</legend>
			<div className="mt-2 grid gap-2 sm:grid-cols-2">
				{state.draft.sources.map((source, index) => {
					const id = source.id ?? `source-${index + 1}`;
					return (
						<label
							key={id}
							className="flex min-h-11 items-center gap-3 rounded-md border border-ink/20 px-3"
						>
							<input
								type="checkbox"
								checked={selected.includes(id)}
								onChange={() =>
									onChange(
										selected.includes(id)
											? selected.filter((sourceId) => sourceId !== id)
											: [...selected, id],
									)
								}
								className="size-5 accent-accent"
							/>
							{source.title || `Bron ${index + 1}`}
						</label>
					);
				})}
			</div>
			<FieldError id={name} error={state.errors[name]} />
		</fieldset>
	);
}

function RouteTotals({ beat }: { beat: AuthoringBeatDraft }) {
	const error = useEventAuthoring().state.errors["beat.routes"];
	return (
		<div
			id="beat.routes"
			tabIndex={-1}
			aria-invalid={error ? "true" : undefined}
			aria-describedby={error ? "beat.routes-error" : undefined}
		>
			<ul className="mt-4 flex flex-wrap gap-3 text-sm">
				{([5, 8, 12] as const).map((duration) => (
					<li
						key={duration}
						className="rounded-full border border-ink/20 px-3 py-2"
					>
						<strong>{duration} min.</strong> · {plannedSeconds(beat, duration)}{" "}
						sec.
					</li>
				))}
			</ul>
			<FieldError id="beat.routes" error={error} />
		</div>
	);
}

function plannedSeconds(beat: AuthoringBeatDraft, duration: 5 | 8 | 12) {
	return beat.stages.reduce((total, stage) => {
		const tier = stageTier(stage);
		if (tier && tier > duration) return total;
		if (stage.phase === "reasoning" && duration < 8) return total;
		return total + (Number(stage.suggestedSeconds) || 0);
	}, 0);
}

function stageTier(stage: AuthoringBeatStage): 5 | 8 | 12 | null {
	return stage.phase === "evidence" || stage.phase === "discussion"
		? stage.earliestDurationMinutes
		: null;
}

function stageLabel(stage: AuthoringBeatStage) {
	return (
		{
			opening: "Startvraag",
			commitment: "Eerste keuze",
			evidence: "Nieuwe informatie",
			discussion: "Bespreking",
			revision: "Opnieuw kiezen",
			reasoning: "Reden geven",
			resolution: "Historische uitleg",
			"lesson-bridge": "Terug naar de les",
		} as const
	)[stage.phase];
}

function nextChoiceId(beat: AuthoringBeatDraft) {
	let index = 1;
	while (beat.choices.some(({ id }) => id === `choice-${index}`)) index += 1;
	return `choice-${index}`;
}

function updateSourceCard(
	beat: AuthoringBeatDraft,
	index: number,
	patch: Partial<AuthoringBeatDraft["sourceCards"][number]>,
	update: (beat: AuthoringBeatDraft) => void,
) {
	const sourceCards = beat.sourceCards.map((card, cardIndex) =>
		cardIndex === index ? { ...card, ...patch } : card,
	) as AuthoringBeatDraft["sourceCards"];
	update({ ...beat, sourceCards });
}
