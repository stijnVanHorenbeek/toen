import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handlePublishEventRequest } from "@/lib/admin/publish-event-handler";

export async function POST(request: Request): Promise<Response> {
	const { env } = getCloudflareContext();
	return handlePublishEventRequest(request, env);
}
