"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";
import { messages } from "@/lib/i18n/messages.nl-BE";

export const inputClass =
	"min-h-12 w-full rounded-md border border-ink/55 bg-white px-4 text-base text-ink focus:border-accent";

export function Field({
	children,
	error,
	hint,
	label,
	name,
}: {
	children: React.ReactNode;
	error?: string;
	hint?: string;
	label: string;
	name: string;
}) {
	const describedBy = [
		hint ? `${name}-hint` : null,
		error ? `${name}-error` : null,
	]
		.filter(Boolean)
		.join(" ");
	const describedChildren = isValidElement(children)
		? cloneElement(
				children as ReactElement<{
					"aria-describedby"?: string;
					"aria-invalid"?: "true";
				}>,
				{
					...(describedBy ? { "aria-describedby": describedBy } : {}),
					...(error ? { "aria-invalid": "true" as const } : {}),
				},
			)
		: children;
	return (
		<div className="min-w-0 flex-1">
			<label htmlFor={name} className="mb-2 block font-semibold text-base">
				{label}
			</label>
			{hint ? (
				<p id={`${name}-hint`} className="mb-2 text-ink/70 text-sm leading-6">
					{hint}
				</p>
			) : null}
			{describedChildren}
			<FieldError id={name} error={error} />
		</div>
	);
}

export function FieldError({ error, id }: { error?: string; id: string }) {
	return error ? (
		<p id={`${id}-error`} className="mt-2 font-semibold text-accent text-sm">
			<span className="sr-only">{messages.admin.errorPrefix} </span>
			{error}
		</p>
	) : null;
}
