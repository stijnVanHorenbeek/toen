import { createRoot } from "react-dom/client";
import { EventDraftForm } from "@/app/_components/admin/event-draft-form";

type AdminBootstrap = {
	topicLabels: Record<string, string>;
	topicOptions: string[];
};

const root = document.querySelector<HTMLElement>("[data-static-admin-root]");
const data = document.getElementById("static-admin-data");
if (!root || !data?.textContent) {
	throw new Error("Missing static admin bootstrap");
}
const bootstrap = JSON.parse(data.textContent) as AdminBootstrap;
createRoot(root).render(<EventDraftForm {...bootstrap} />);
