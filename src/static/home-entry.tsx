import { hydrateRoot } from "react-dom/client";
import { EventExplorer } from "@/app/_components/event-explorer/event-explorer";
import type { EventExplorerBootstrap } from "@/lib/content/event-explorer-data";

const root = document.querySelector<HTMLElement>("[data-static-explorer-root]");
const data = document.getElementById("static-explorer-data");
if (!root || !data?.textContent) {
	throw new Error("Missing static explorer bootstrap");
}
const bootstrap = JSON.parse(data.textContent) as EventExplorerBootstrap;
hydrateRoot(root, <EventExplorer bootstrap={bootstrap} />);
