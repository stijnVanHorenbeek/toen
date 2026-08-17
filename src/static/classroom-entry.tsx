import { hydrateRoot } from "react-dom/client";
import { BeatPlayer } from "@/app/_components/beat-player";
import type { BeatPlayerEvent } from "@/app/_components/classroom/types";

const root = document.querySelector<HTMLElement>(
	"[data-static-classroom-root]",
);
const data = document.getElementById("static-classroom-data");
if (!root || !data?.textContent) {
	throw new Error("Missing static classroom bootstrap");
}
const event = JSON.parse(data.textContent) as BeatPlayerEvent;
hydrateRoot(root, <BeatPlayer event={event} />);
