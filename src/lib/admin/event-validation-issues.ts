import type { ZodError } from "zod";
import { messages } from "../i18n/messages.nl-BE";

export type EventValidationIssue = { field: string; message: string };

export function eventValidationIssues(error: ZodError): EventValidationIssue[] {
	return error.issues.map((issue) => {
		const field = issue.path.join(".");
		return { field, message: eventValidationMessage(field) };
	});
}

function eventValidationMessage(field: string): string {
	if (field === "title") return messages.errors.title;
	if (field.startsWith("date")) return messages.errors.date;
	if (field === "summary") return messages.errors.summary;
	if (field === "body") return messages.errors.body;
	if (field === "profiles") return messages.errors.profiles;
	if (field === "topics") return messages.errors.topics;
	if (field.endsWith(".url")) return messages.errors.sourceUrl;
	if (field.startsWith("sources")) return messages.errors.source;
	return messages.errors.field;
}
