"use client";

import { useEffect, useRef, useState } from "react";
import { parseExactHistoricalDate } from "@/lib/admin/authoring-draft";
import { vakrichtingIds } from "@/lib/content/taxonomy";
import {
	formatEventTag,
	formatSourceHeading,
	formatSourceLabel,
	formatSourceMove,
	formatStep,
	formatVakrichting,
	historicalDateMessages,
} from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { ChatGptPromptHandoff } from "./chatgpt-prompt-handoff";
import { useEventAuthoring } from "./event-authoring-context";
import { EventStoryEditor } from "./event-story-editor";
import { Field, FieldError, inputClass } from "./form-controls";

export { Field, FieldError, inputClass } from "./form-controls";

export function StoryStage() {
	const { state, actions } = useEventAuthoring();
	const { draft, errors } = state;
	return (
		<section aria-labelledby="story-stage-title" className="authoring-panel">
			<StageHeader
				step={formatStep(1, 4)}
				title={messages.admin.steps[0]}
				id="story-stage-title"
			>
				{messages.admin.storyIntro}
			</StageHeader>
			<ChatGptPromptHandoff />
			<RequiredFieldsNotice />
			<ErrorSummary errors={errors} />
			<div className="space-y-8">
				<Field
					label={messages.admin.fields.title}
					name="title"
					error={errors.title}
					hint={messages.admin.fields.titleHint}
				>
					<input
						id="title"
						name="title"
						required
						autoComplete="off"
						value={draft.title}
						onChange={(event) => actions.update("title", event.target.value)}
						aria-invalid={errors.title ? "true" : undefined}
						aria-describedby={fieldDescription("title", errors.title)}
						className={inputClass}
					/>
				</Field>
				<HistoricalDateFields />
				<Field
					label={messages.admin.fields.summary}
					name="summary"
					error={errors.summary}
					hint={messages.admin.fields.summaryHint}
				>
					<textarea
						id="summary"
						name="summary"
						required
						autoComplete="off"
						rows={3}
						value={draft.summary}
						onChange={(event) => actions.update("summary", event.target.value)}
						aria-invalid={errors.summary ? "true" : undefined}
						aria-describedby={fieldDescription("summary", errors.summary)}
						className={`${inputClass} resize-y py-3`}
					/>
				</Field>
				<div>
					<label className="mb-2 block font-semibold text-base" htmlFor="body">
						{messages.admin.fields.story}
					</label>
					<EventStoryEditor
						error={errors.body}
						value={draft.body}
						onChange={(value) => actions.update("body", value)}
					/>
				</div>
			</div>
			<StageActions>
				<button
					type="button"
					onClick={actions.continueStory}
					className="primary-button"
				>
					{messages.admin.actions.continue}
				</button>
			</StageActions>
		</section>
	);
}

function HistoricalDateFields() {
	const { state, actions } = useEventAuthoring();
	const { draft, errors } = state;
	const calendarInputRef = useRef<HTMLInputElement>(null);
	const directParts = draft.precision !== "day" || draft.era === "bce";
	return (
		<fieldset className="space-y-5">
			<legend className="font-serif text-2xl font-semibold">
				{messages.admin.fields.date}
			</legend>
			<div className="grid gap-5 sm:grid-cols-2">
				<Field label={messages.admin.fields.precision} name="precision">
					<select
						id="precision"
						name="precision"
						value={draft.precision}
						onChange={(event) =>
							actions.update(
								"precision",
								event.target.value as typeof draft.precision,
							)
						}
						className={inputClass}
					>
						<option value="day">
							{messages.admin.fields.precisionOptions.day}
						</option>
						<option value="month">
							{messages.admin.fields.precisionOptions.month}
						</option>
						<option value="year">
							{messages.admin.fields.precisionOptions.year}
						</option>
						<option value="approximate">
							{messages.admin.fields.precisionOptions.approximate}
						</option>
					</select>
				</Field>
				<Field label={messages.admin.fields.era} name="era">
					<select
						id="era"
						name="era"
						value={draft.era}
						onChange={(event) =>
							actions.update("era", event.target.value as "ce" | "bce")
						}
						className={inputClass}
					>
						<option value="ce">{historicalDateMessages.afterCommonEra}</option>
						<option value="bce">
							{historicalDateMessages.beforeCommonEra}
						</option>
					</select>
				</Field>
			</div>
			{draft.precision === "day" && draft.era === "ce" ? (
				<Field
					label={messages.admin.fields.exactDate}
					name="exactDate"
					error={errors.exactDate}
					hint={messages.admin.fields.exactDateHint}
				>
					<div className="flex max-w-xl flex-col gap-3 sm:flex-row">
						<input
							id="exactDate"
							name="exactDate"
							required
							type="text"
							inputMode="numeric"
							placeholder={messages.admin.fields.exactDatePlaceholder}
							value={draft.exactDate}
							onChange={(event) =>
								actions.update("exactDate", event.target.value)
							}
							aria-invalid={errors.exactDate ? "true" : undefined}
							aria-describedby={fieldDescription("exactDate", errors.exactDate)}
							className={inputClass}
						/>
						<div className="relative shrink-0">
							<button
								type="button"
								aria-label={messages.admin.fields.calendar}
								title={messages.admin.fields.calendarChoice}
								onClick={() => {
									const input = calendarInputRef.current;
									if (!input) return;
									const picker = input as {
										click: () => void;
										showPicker?: () => void;
									};
									if (typeof picker.showPicker === "function")
										picker.showPicker();
									else picker.click();
								}}
								className="secondary-button size-12 px-0"
							>
								<svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
									<path
										d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
										fill="none"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="1.75"
									/>
								</svg>
							</button>
							<input
								ref={calendarInputRef}
								data-calendar-input
								type="date"
								tabIndex={-1}
								aria-hidden="true"
								value={calendarValue(draft.exactDate)}
								onChange={(event) =>
									actions.update(
										"exactDate",
										formatCalendarValue(event.target.value),
									)
								}
								className="pointer-events-none absolute inset-0 size-px opacity-0"
							/>
						</div>
					</div>
				</Field>
			) : null}
			{directParts ? (
				<div className="grid gap-5 sm:grid-cols-3">
					{draft.precision === "day" ? (
						<Field
							label={messages.admin.fields.day}
							name="day"
							error={errors.day}
						>
							<input
								id="day"
								name="day"
								required
								type="number"
								inputMode="numeric"
								min={1}
								max={31}
								value={draft.day}
								onChange={(event) => actions.update("day", event.target.value)}
								aria-invalid={errors.day ? "true" : undefined}
								aria-describedby={errors.day ? "day-error" : undefined}
								className={inputClass}
							/>
						</Field>
					) : null}
					{draft.precision === "day" || draft.precision === "month" ? (
						<Field
							label={messages.admin.fields.month}
							name="month"
							error={errors.month}
						>
							<select
								id="month"
								name="month"
								required
								value={draft.month}
								onChange={(event) =>
									actions.update("month", event.target.value)
								}
								aria-invalid={errors.month ? "true" : undefined}
								aria-describedby={errors.month ? "month-error" : undefined}
								className={inputClass}
							>
								<option value="">{messages.admin.fields.chooseMonth}</option>
								{historicalDateMessages.months.map((month, index) => (
									<option key={month} value={index + 1}>
										{month}
									</option>
								))}
							</select>
						</Field>
					) : null}
					<Field
						label={messages.admin.fields.year}
						name="year"
						error={errors.year}
					>
						<input
							id="year"
							name="year"
							required
							type="number"
							inputMode="numeric"
							min={1}
							value={draft.year}
							onChange={(event) => actions.update("year", event.target.value)}
							aria-invalid={errors.year ? "true" : undefined}
							aria-describedby={errors.year ? "year-error" : undefined}
							className={inputClass}
						/>
					</Field>
				</div>
			) : null}
		</fieldset>
	);
}

export function ClassificationStage() {
	const { state, actions, meta } = useEventAuthoring();
	const [newTopic, setNewTopic] = useState("");
	const { draft, errors } = state;
	const topicOptions = [...new Set([...meta.topicOptions, ...draft.topics])];
	return (
		<section
			aria-labelledby="classification-stage-title"
			className="authoring-panel"
		>
			<StageHeader
				step={formatStep(2, 4)}
				title={messages.admin.steps[1]}
				id="classification-stage-title"
			>
				{messages.admin.classificationIntro}
			</StageHeader>
			<RequiredFieldsNotice />
			<ErrorSummary errors={errors} />
			{state.previewError ? (
				<p
					role="alert"
					className="mb-8 rounded-md border border-accent bg-white p-4 font-semibold text-accent"
				>
					{state.previewError}
				</p>
			) : null}
			<div className="space-y-10">
				<fieldset
					id="profiles"
					tabIndex={-1}
					aria-describedby={errors.profiles ? "profiles-error" : undefined}
					aria-invalid={errors.profiles ? "true" : undefined}
				>
					<legend className="font-serif text-2xl font-semibold">
						{messages.admin.fields.profiles}
					</legend>
					<p className="mt-2 text-ink/70 text-sm">
						{messages.admin.fields.profilesHint}
					</p>
					<div className="mt-5 grid gap-3 sm:grid-cols-2">
						{vakrichtingIds.map((profile) => (
							<label
								key={profile}
								className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-ink/50 bg-white px-4 text-base"
							>
								<input
									type="checkbox"
									checked={draft.profiles.includes(profile)}
									onChange={() => actions.toggleProfile(profile)}
									className="size-5 accent-accent"
								/>
								{formatVakrichting(profile)}
							</label>
						))}
					</div>
					<FieldError id="profiles" error={errors.profiles} />
				</fieldset>
				<fieldset
					id="topics"
					tabIndex={-1}
					aria-describedby={errors.topics ? "topics-error" : undefined}
					aria-invalid={errors.topics ? "true" : undefined}
				>
					<legend className="font-serif text-2xl font-semibold">
						{messages.admin.fields.topics}
					</legend>
					<div className="mt-4 flex flex-wrap gap-2">
						{topicOptions.map((topic) => (
							<button
								key={topic}
								type="button"
								aria-pressed={draft.topics.includes(topic)}
								onClick={() =>
									draft.topics.includes(topic)
										? actions.removeTopic(topic)
										: actions.selectTopic(
												topic,
												meta.topicLabels[topic] ?? formatEventTag(topic),
											)
								}
								className="compact-button rounded-full border border-ink/50 px-3 py-2 text-sm aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
							>
								{draft.topicLabels[topic] ??
									meta.topicLabels[topic] ??
									formatEventTag(topic)}
							</button>
						))}
					</div>
					<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
						<Field
							label={messages.admin.fields.newTopic}
							name="newTopic"
							hint={messages.admin.fields.newTopicHint}
						>
							<input
								id="newTopic"
								name="newTopic"
								autoComplete="off"
								value={newTopic}
								onChange={(event) => setNewTopic(event.target.value)}
								className={inputClass}
							/>
						</Field>
						<button
							type="button"
							onClick={() => {
								actions.addTopic(newTopic);
								setNewTopic("");
							}}
							className="secondary-button shrink-0"
						>
							{messages.admin.actions.addTopic}
						</button>
					</div>
					<FieldError id="topics" error={errors.topics} />
				</fieldset>
				<SourcesFields />
			</div>
			<StageActions>
				<button
					type="button"
					onClick={() => actions.goToStep(1)}
					className="text-button"
				>
					{messages.admin.actions.backStory}
				</button>
				<button
					type="button"
					onClick={actions.continueClassification}
					className="primary-button"
				>
					{messages.admin.actions.continueActivity}
				</button>
			</StageActions>
		</section>
	);
}

function SourcesFields() {
	const { state, actions } = useEventAuthoring();
	return (
		<fieldset id="sources" tabIndex={-1}>
			<legend className="font-serif text-2xl font-semibold">
				{messages.admin.fields.sources}
			</legend>
			<p className="mt-2 text-ink/70 text-sm">
				{messages.admin.fields.sourcesHint}
			</p>
			<div className="mt-5 space-y-5">
				{state.draft.sources.map((source, index) => (
					<section
						key={source.id ?? index}
						aria-labelledby={`source-${index + 1}-heading`}
						className="rounded-md border border-ink/25 bg-white p-5"
					>
						<div className="flex items-center justify-between gap-4">
							<h3
								id={`source-${index + 1}-heading`}
								className="font-serif text-xl font-semibold"
							>
								{formatSourceHeading(index + 1)}
							</h3>
							<div className="flex gap-1">
								<button
									type="button"
									aria-label={formatSourceMove(index + 1, "up")}
									disabled={index === 0}
									onClick={() => actions.moveSource(index, -1)}
									className="small-button"
								>
									↑
								</button>
								<button
									type="button"
									aria-label={formatSourceMove(index + 1, "down")}
									disabled={index === state.draft.sources.length - 1}
									onClick={() => actions.moveSource(index, 1)}
									className="small-button"
								>
									↓
								</button>
								<button
									type="button"
									disabled={state.draft.sources.length === 1}
									onClick={() => actions.removeSource(index)}
									className="small-button"
								>
									{messages.admin.actions.remove}
								</button>
							</div>
						</div>
						<div className="mt-5 grid gap-5 sm:grid-cols-2">
							<SourceInput
								index={index}
								field="title"
								label={formatSourceLabel("title", index + 1)}
								value={source.title}
							/>
							<SourceInput
								index={index}
								field="publisher"
								label={formatSourceLabel("publisher", index + 1)}
								value={source.publisher}
							/>
							<SourceInput
								index={index}
								field="url"
								label={formatSourceLabel("url", index + 1)}
								value={source.url}
								type="url"
							/>
						</div>
					</section>
				))}
			</div>
			<button
				type="button"
				onClick={actions.addSource}
				className="secondary-button mt-5"
			>
				{messages.admin.actions.addSource}
			</button>
		</fieldset>
	);
}

function SourceInput({
	index,
	field,
	label,
	value,
	type = "text",
}: {
	index: number;
	field: "title" | "publisher" | "url";
	label: string;
	value: string;
	type?: "text" | "url";
}) {
	const { state, actions } = useEventAuthoring();
	const errorKey = `sources.${index}.${field}`;
	return (
		<Field label={label} name={errorKey} error={state.errors[errorKey]}>
			<input
				id={errorKey}
				name={errorKey}
				type={type}
				required
				autoComplete="off"
				placeholder={
					field === "url"
						? messages.admin.fields.sourceUrlPlaceholder
						: undefined
				}
				value={value}
				onChange={(event) =>
					actions.updateSource(index, field, event.target.value)
				}
				aria-invalid={state.errors[errorKey] ? "true" : undefined}
				aria-describedby={
					state.errors[errorKey] ? `${errorKey}-error` : undefined
				}
				className={inputClass}
			/>
		</Field>
	);
}

function RequiredFieldsNotice() {
	return (
		<p className="-mt-5 mb-8 text-ink/70 text-sm">{messages.admin.required}</p>
	);
}

export function ErrorSummary({
	errors,
	onFieldSelect,
}: {
	errors: Record<string, string>;
	onFieldSelect?: (field: string) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const entries = Object.entries(errors);
	useEffect(() => {
		if (entries.length > 0) ref.current?.focus();
	}, [entries.length]);
	if (entries.length === 0) return null;
	return (
		<div
			ref={ref}
			tabIndex={-1}
			role="alert"
			className="mb-8 rounded-md border-2 border-accent bg-white p-5"
		>
			<h3 className="font-serif text-xl font-semibold">
				{messages.admin.errorSummary}
			</h3>
			<ul className="mt-3 list-disc space-y-2 pl-5">
				{entries.map(([field, message]) => (
					<li key={field}>
						<a
							href={`#${field}`}
							onClick={(event) => {
								if (!onFieldSelect) return;
								event.preventDefault();
								onFieldSelect(field);
							}}
							className="font-semibold text-accent underline underline-offset-4"
						>
							{message}
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}

function calendarValue(value: string): string {
	const date = parseExactHistoricalDate(value);
	if (!date) return "";
	return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function formatCalendarValue(value: string): string {
	const date = parseExactHistoricalDate(value);
	if (!date) return "";
	return `${String(date.day).padStart(2, "0")}.${String(date.month).padStart(2, "0")}.${date.year}`;
}

function fieldDescription(name: string, error?: string) {
	return error ? `${name}-hint ${name}-error` : `${name}-hint`;
}

export function StageHeader({
	children,
	id,
	step,
	title,
}: {
	children: React.ReactNode;
	id: string;
	step: string;
	title: string;
}) {
	return (
		<header className="mb-10 border-ink/20 border-b pb-7">
			<p className="font-semibold text-accent text-xs uppercase tracking-[0.18em]">
				{step}
			</p>
			<h2
				id={id}
				tabIndex={-1}
				className="mt-3 text-balance font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-5xl"
			>
				{title}
			</h2>
			<p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-ink/75">
				{children}
			</p>
		</header>
	);
}

export function StageActions({ children }: { children: React.ReactNode }) {
	return (
		<div className="stage-actions mt-10 flex flex-wrap items-center gap-4 border-ink/20 border-t pt-7 max-sm:[&>*]:w-full">
			{children}
		</div>
	);
}
