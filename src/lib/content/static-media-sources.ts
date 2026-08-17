import type { HistoricalVisualId } from "./event-media";

export const historicalVisualSourcePaths = {
	"apollo-11-aldrin": "media/sources/apollo-11-aldrin.webp",
	"belgian-revolution-wappers": "media/sources/belgian-revolution-wappers.webp",
	"d-day-omaha-beach": "media/sources/d-day-omaha-beach.webp",
	"fall-of-constantinople-dudley":
		"media/sources/fall-of-constantinople-dudley.webp",
} as const satisfies Record<HistoricalVisualId, string>;
