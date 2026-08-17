import type { InteractiveBeat } from "@/lib/content/event";
import type { Event } from "@/lib/content/event-document";

export type BeatPlayerEvent = Pick<Event, "slug" | "title" | "sources"> & {
	beat: InteractiveBeat;
};

export type BeatPlayerVariant = "page" | "preview";
