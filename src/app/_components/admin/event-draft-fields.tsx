import type { ReactNode } from "react";

const inputClassName =
	"min-h-11 rounded-sm border border-ink/25 bg-paper px-3 text-base";

export function EventDraftFields() {
	return (
		<div className="space-y-10">
			<FieldSection legend="Identiteit">
				<TextField label="Slug" name="slug" />
				<TextField label="Titel" name="title" />
				<TextAreaField label="Samenvatting" name="summary" rows={3} />
			</FieldSection>
			<HistoricalDateFields />
			<FieldSection legend="Classificatie">
				<TextField
					label="Onderwerpen"
					name="topics"
					placeholder="politiek, oorlog"
				/>
				<TextField label="Profielen" name="profiles" placeholder="algemeen" />
			</FieldSection>
			<FieldSection legend="Bron">
				<TextField label="Brontitel" name="sourceTitle" />
				<TextField label="Bronuitgever" name="sourcePublisher" />
				<TextField label="Bron-URL" name="sourceUrl" type="url" />
			</FieldSection>
			<FieldSection legend="Verhaal">
				<TextAreaField label="Markdowntekst" name="body" rows={12} />
			</FieldSection>
		</div>
	);
}

function HistoricalDateFields() {
	return (
		<FieldSection legend="Historische datum">
			<TextField label="Jaar" name="year" type="number" />
			<SelectField label="Tijdrekening" name="era">
				<option value="ce">n.Chr.</option>
				<option value="bce">v.Chr.</option>
			</SelectField>
			<TextField label="Maand" name="month" type="number" />
			<TextField label="Dag" name="day" type="number" />
		</FieldSection>
	);
}

function FieldSection({
	children,
	legend,
}: {
	children: ReactNode;
	legend: string;
}) {
	return (
		<fieldset className="grid gap-5 sm:grid-cols-2">
			<legend className="mb-5 w-full border-ink/15 border-b pb-3 font-serif text-2xl font-semibold">
				{legend}
			</legend>
			{children}
		</fieldset>
	);
}

function TextField({
	label,
	name,
	placeholder,
	type = "text",
}: {
	label: string;
	name: string;
	placeholder?: string;
	type?: "text" | "number" | "url";
}) {
	return (
		<FieldLabel htmlFor={name} label={label}>
			<input
				id={name}
				name={name}
				type={type}
				placeholder={placeholder}
				required
				className={inputClassName}
			/>
		</FieldLabel>
	);
}

function TextAreaField({
	label,
	name,
	rows,
}: {
	label: string;
	name: string;
	rows: number;
}) {
	return (
		<FieldLabel htmlFor={name} label={label}>
			<textarea
				id={name}
				name={name}
				rows={rows}
				required
				className={`${inputClassName} resize-y py-3`}
			/>
		</FieldLabel>
	);
}

function SelectField({
	children,
	label,
	name,
}: {
	children: ReactNode;
	label: string;
	name: string;
}) {
	return (
		<FieldLabel htmlFor={name} label={label}>
			<select id={name} name={name} className={inputClassName}>
				{children}
			</select>
		</FieldLabel>
	);
}

function FieldLabel({
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
			className="grid content-start gap-2 font-semibold text-xs uppercase tracking-[0.14em]"
		>
			{label}
			{children}
		</label>
	);
}
