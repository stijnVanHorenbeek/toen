import { ZodError } from "zod";
import { createEventDraftPreview } from "@/lib/content/event-draft";

export async function POST(request: Request): Promise<Response> {
	try {
		const preview = createEventDraftPreview(await request.json());
		return Response.json(preview, {
			headers: { "Cache-Control": "no-store" },
		});
	} catch (error) {
		if (error instanceof SyntaxError || error instanceof ZodError) {
			return Response.json(
				{ error: "Ongeldige gebeurtenis." },
				{
					status: 400,
					headers: { "Cache-Control": "no-store" },
				},
			);
		}
		throw error;
	}
}
