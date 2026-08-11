"use client";

import type { ReactNode } from "react";
import { formatEventTag } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import { useEventExplorer } from "./event-explorer-context";

const controlClassName =
	"min-h-11 w-full min-w-0 rounded-sm border border-ink/25 bg-white px-3 font-normal text-base tracking-normal";

export function EventFilters() {
	const { state, actions } = useEventExplorer();

	return (
		<section
			aria-labelledby="activity-filters-title"
			className="rounded-md border border-ink/15 bg-white/35 p-5 sm:p-6"
		>
			<h2
				id="activity-filters-title"
				className="font-semibold text-sm uppercase tracking-[0.12em]"
			>
				{messages.home.findTitle}
			</h2>
			<div className="mt-4 grid gap-5">
				<FilterField htmlFor="event-search" label={messages.home.search}>
					<input
						id="event-search"
						type="search"
						value={state.query}
						placeholder={messages.home.searchPlaceholder}
						onChange={(event) => actions.update("query", event.target.value)}
						className={controlClassName}
					/>
				</FilterField>
				<TopicFilters />
				<DateAndPeriodFilters />
			</div>
		</section>
	);
}

function FilterField({
	children,
	htmlFor,
	label,
}: {
	children: ReactNode;
	htmlFor: string;
	label: string;
}) {
	return (
		<label
			htmlFor={htmlFor}
			className="grid gap-2 font-semibold text-xs uppercase tracking-[0.14em]"
		>
			{label}
			{children}
		</label>
	);
}

function TopicFilters() {
	const { state, actions, meta } = useEventExplorer();
	if (meta.topicOptions.length === 0) return null;

	return (
		<fieldset>
			<legend className="font-semibold text-xs uppercase tracking-[0.14em]">
				{messages.home.topics}
			</legend>
			<div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
				{meta.topicOptions.map((topic) => {
					const label = meta.topicLabels[topic] ?? formatEventTag(topic);
					return (
						<label
							key={topic}
							className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-ink/15 bg-white px-3 text-sm"
						>
							<input
								type="checkbox"
								checked={state.topics.includes(topic)}
								onChange={() => actions.toggleTopic(topic)}
								className="size-5 shrink-0 accent-accent"
							/>
							{label}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

function DateAndPeriodFilters() {
	const { state, actions } = useEventExplorer();

	return (
		<details className="border-ink/15 border-t pt-2">
			<summary className="flex min-h-11 cursor-pointer list-none items-center font-bold text-sm underline decoration-accent/45 underline-offset-4 [&::-webkit-details-marker]:hidden">
				{messages.home.dateAndPeriod}
			</summary>
			<fieldset className="grid gap-4 pt-3">
				<legend className="sr-only">{messages.home.dateAndPeriod}</legend>
				<FilterField htmlFor="event-week" label={messages.home.week}>
					<input
						id="event-week"
						type="date"
						value={state.selectedDate}
						onChange={(event) =>
							actions.update("selectedDate", event.target.value)
						}
						className={controlClassName}
					/>
				</FilterField>
				<div className="grid grid-cols-2 gap-3">
					<YearFilter
						id="event-year-min"
						label={messages.home.fromYear}
						value={state.yearMin}
						onChange={(value) => actions.update("yearMin", value)}
					/>
					<YearFilter
						id="event-year-max"
						label={messages.home.toYear}
						value={state.yearMax}
						onChange={(value) => actions.update("yearMax", value)}
					/>
				</div>
			</fieldset>
		</details>
	);
}

function YearFilter({
	id,
	label,
	onChange,
	value,
}: {
	id: string;
	label: string;
	onChange: (value: number) => void;
	value: number;
}) {
	return (
		<FilterField htmlFor={id} label={label}>
			<input
				id={id}
				type="number"
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				className={controlClassName}
			/>
		</FilterField>
	);
}
