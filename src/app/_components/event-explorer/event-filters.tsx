"use client";

import type { ReactNode } from "react";
import { useEventExplorer } from "./event-explorer-context";
import { formatEventTag } from "./event-labels";

const controlClassName =
	"min-h-11 rounded-sm border border-ink/25 bg-transparent px-3 font-normal text-base tracking-normal";

export function EventFilters() {
	const { state, actions } = useEventExplorer();

	return (
		<>
			<FilterGrid>
				<FilterField htmlFor="event-week" label="Week">
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
				<YearFilter
					id="event-year-min"
					label="Van jaar"
					value={state.yearMin}
					onChange={(value) => actions.update("yearMin", value)}
				/>
				<YearFilter
					id="event-year-max"
					label="Tot jaar"
					value={state.yearMax}
					onChange={(value) => actions.update("yearMax", value)}
				/>
				<ProfileFilter />
			</FilterGrid>
			<TopicFilters />
		</>
	);
}

function FilterGrid({ children }: { children: ReactNode }) {
	return (
		<fieldset className="grid gap-5 border-ink/15 border-y py-6 lg:grid-cols-[1.15fr_0.75fr_0.75fr_1fr] lg:items-end">
			<legend className="sr-only">Lescontext</legend>
			{children}
		</fieldset>
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
			className="grid gap-2 font-semibold text-xs uppercase tracking-[0.15em]"
		>
			{label}
			{children}
		</label>
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

function ProfileFilter() {
	const { state, actions, meta } = useEventExplorer();

	return (
		<FilterField htmlFor="event-profile" label="Profiel">
			<select
				id="event-profile"
				value={state.profile}
				onChange={(event) => actions.update("profile", event.target.value)}
				className={controlClassName}
			>
				<option value="algemeen">Algemeen</option>
				{meta.profileOptions
					.filter((value) => value !== "algemeen")
					.map((value) => (
						<option key={value} value={value}>
							{formatEventTag(value)}
						</option>
					))}
			</select>
		</FilterField>
	);
}

function TopicFilters() {
	const { state, actions, meta } = useEventExplorer();

	return (
		<div className="flex flex-wrap gap-x-5 gap-y-3 border-ink/15 border-b py-5">
			<span className="font-semibold text-xs uppercase tracking-[0.15em]">
				Onderwerpen
			</span>
			{meta.topicOptions.map((topic) => (
				<label key={topic} className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={state.topics.includes(topic)}
						onChange={() => actions.toggleTopic(topic)}
						className="size-4 accent-accent"
					/>
					{formatEventTag(topic)}
				</label>
			))}
		</div>
	);
}
