import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handlePreviewEventRequest } from "@/lib/admin/preview-event-handler";

export async function POST(request: Request): Promise<Response> {
	const { env } = getCloudflareContext();
	return handlePreviewEventRequest(request, env);
}
