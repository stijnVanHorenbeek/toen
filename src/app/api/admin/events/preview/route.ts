import { ZodError } from "zod";
import { eventValidationIssues } from "@/lib/admin/event-validation-issues";
import { createEventDraftPreview } from "@/lib/content/event-draft";
import { messages } from "@/lib/i18n/messages.nl-BE";

export async function POST(request: Request): Promise<Response> {
	try {
		const preview = createEventDraftPreview(await request.json());
		return Response.json(preview, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		if (error instanceof ZodError) {
			return Response.json(
				{
					code: "invalid_event",
					error: messages.errors.invalidEvent,
					issues: eventValidationIssues(error),
				},
				{
					status: 400,
					headers: { "Cache-Control": "no-store" },
				},
			);
		}
		if (error instanceof SyntaxError) {
			return Response.json(
				{ code: "invalid_json", error: messages.errors.invalidJson },
				{
					status: 400,
					headers: { "Cache-Control": "no-store" },
				},
			);
		}
		throw error;
	}
}
