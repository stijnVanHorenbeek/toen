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
	if (field === "beat.question") return messages.errors.beatQuestion;
	if (/^beat\.choices\.\d+\.label$/.test(field)) {
		return messages.errors.beatChoice;
	}
	if (field === "beat.responseMethod") {
		return messages.errors.beatResponseMethod;
	}
	if (field.endsWith(".teacherPrompt")) {
		return messages.errors.beatTeacherPrompt;
	}
	if (field.endsWith(".expectedStudentAction")) {
		return messages.errors.beatStudentAction;
	}
	if (
		field.endsWith(".suggestedSeconds") ||
		field.endsWith(".earliestDurationMinutes")
	) {
		return messages.errors.beatTiming;
	}
	if (field.startsWith("beat.routes")) return messages.errors.beatRoute;
	if (
		field.startsWith("beat") &&
		(field.endsWith("sourceUrl") || field.includes("sourceUrls"))
	) {
		return messages.errors.beatSource;
	}
	if (
		field === "beat.perspective" ||
		field === "beat.vocationalConnection" ||
		/^beat\.stages\.\d+\.(stimulus|prompt|title|evidence|feedback|bridge)$/.test(
			field,
		)
	) {
		return messages.errors.beatProjectedContent;
	}
	if (field.startsWith("beat")) return messages.errors.beatField;
	return messages.errors.field;
}
