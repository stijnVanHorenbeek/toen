import { z } from "zod";
import { historicalDateMessages } from "../i18n/locale";
import { messages } from "../i18n/messages.nl-BE";
import { vakrichtingIds } from "./taxonomy";

const historicalYearSchema = {
	year: z.int().positive(),
	era: z.enum(["ce", "bce"]),
};

const dayHistoricalDateSchema = z
	.strictObject({
		...historicalYearSchema,
		precision: z.literal("day"),
		month: z.int().min(1).max(12),
		day: z.int().min(1).max(31),
	})
	.refine(
		({ day, month }) =>
			day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1],
		{ path: ["day"], message: messages.errors.dayImpossible },
	);

const historicalDateSchema = z.discriminatedUnion("precision", [
	dayHistoricalDateSchema,
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

export const topicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const topicIdSchema = z.string().regex(topicIdPattern);

const sourceSchema = z.strictObject({
	title: z.string().trim().min(1),
	publisher: z.string().trim().min(1),
	url: z.url().refine((value) => {
		if (!URL.canParse(value)) return false;
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}),
});

export const eventFrontmatterSchema = z
	.strictObject({
		title: z.string().trim().min(1),
		date: historicalDateSchema,
		summary: z.string().trim().min(1),
		topics: z.array(topicIdSchema).min(1),
		topicLabels: z.record(topicIdSchema, z.string().trim().min(1)).optional(),
		profiles: z.array(z.enum(vakrichtingIds)).min(1),
		sources: z.array(sourceSchema).min(1),
	})
	.superRefine(validateSelectedTopicLabels);

export function validateSelectedTopicLabels(
	value: { topics: string[]; topicLabels?: Record<string, string> },
	context: z.RefinementCtx,
): void {
	for (const topic of Object.keys(value.topicLabels ?? {})) {
		if (!value.topics.includes(topic)) {
			context.addIssue({
				code: "custom",
				path: ["topicLabels", topic],
				message: messages.errors.field,
			});
		}
	}
}

export type EventFrontmatter = z.infer<typeof eventFrontmatterSchema>;
export type HistoricalDate = z.infer<typeof historicalDateSchema>;

export function parseEventFrontmatter(value: unknown): EventFrontmatter {
	return eventFrontmatterSchema.parse(value);
}

export function formatHistoricalDate(date: HistoricalDate): string {
	const year =
		date.era === "bce"
			? `${date.year} ${historicalDateMessages.beforeCommonEra}`
			: String(date.year);

	switch (date.precision) {
		case "day":
			return `${date.day} ${historicalDateMessages.months[date.month - 1]} ${year}`;
		case "month":
			return `${historicalDateMessages.months[date.month - 1]} ${year}`;
		case "approximate":
			return `${historicalDateMessages.circa} ${year}`;
		case "year":
			return year;
	}
}
