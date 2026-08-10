import { z } from "zod";

const historicalYearSchema = {
	year: z.int().positive(),
	era: z.enum(["ce", "bce"]),
};

const historicalDateSchema = z.discriminatedUnion("precision", [
	z.strictObject({
		...historicalYearSchema,
		precision: z.literal("day"),
		month: z.int().min(1).max(12),
		day: z.int().min(1).max(31),
	}),
	z.strictObject({
		...historicalYearSchema,
		precision: z.literal("month"),
		month: z.int().min(1).max(12),
	}),
	z.strictObject({
		...historicalYearSchema,
		precision: z.literal("year"),
	}),
	z.strictObject({
		...historicalYearSchema,
		precision: z.literal("approximate"),
	}),
]);

const sourceSchema = z.strictObject({
	title: z.string().trim().min(1),
	publisher: z.string().trim().min(1),
	url: z.url(),
});

export const eventFrontmatterSchema = z.strictObject({
	title: z.string().trim().min(1),
	date: historicalDateSchema,
	summary: z.string().trim().min(1),
	topics: z.array(z.string().trim().min(1)).min(1),
	profiles: z.array(z.string().trim().min(1)).min(1),
	sources: z.array(sourceSchema).min(1),
});

export type EventFrontmatter = z.infer<typeof eventFrontmatterSchema>;
export type HistoricalDate = z.infer<typeof historicalDateSchema>;

export function parseEventFrontmatter(value: unknown): EventFrontmatter {
	return eventFrontmatterSchema.parse(value);
}

const monthNames = [
	"januari",
	"februari",
	"maart",
	"april",
	"mei",
	"juni",
	"juli",
	"augustus",
	"september",
	"oktober",
	"november",
	"december",
];

export function formatHistoricalDate(date: HistoricalDate): string {
	const year = date.era === "bce" ? `${date.year} v.Chr.` : String(date.year);

	switch (date.precision) {
		case "day":
			return `${date.day} ${monthNames[date.month - 1]} ${year}`;
		case "month":
			return `${monthNames[date.month - 1]} ${year}`;
		case "approximate":
			return `ca. ${year}`;
		case "year":
			return year;
	}
}
