import { z } from "zod";
import {
	type HistoricalDate,
	type InteractiveBeat,
	topicIdPattern,
} from "../content/event";
import { type VakrichtingId, vakrichtingIds } from "../content/taxonomy";
import { formatEventTag } from "../i18n/locale";
import { messages } from "../i18n/messages.nl-BE";
import { type AiDraftReview, aiDraftReviewSchema } from "./ai-draft-review";
import {
	type AuthoringBeatDraft,
	authoringBeatDraftSchema,
	createInitialAuthoringBeatDraft,
	toCanonicalInteractiveBeat,
} from "./authoring-beat";

export type DatePrecision = HistoricalDate["precision"];

export type AuthoringSource = {
	id?: string;
	title: string;
	publisher: string;
	url: string;
};

export { createInitialAuthoringBeatDraft };
export type AuthoringStep = 1 | 2 | 3 | 4;

export type AuthoringDraft = {
	title: string;
	precision: DatePrecision;
	era: "ce" | "bce";
	exactDate: string;
	year: string;
	month: string;
	day: string;
	summary: string;
	body: string;
	profiles: VakrichtingId[];
	topics: string[];
	topicLabels: Record<string, string>;
	sources: AuthoringSource[];
	beat: AuthoringBeatDraft | null;
};

export type EventDraftInput = {
	title: string;
	date: HistoricalDate;
	summary: string;
	body: string;
	profiles: VakrichtingId[];
	topics: string[];
	topicLabels?: Record<string, string>;
	sources: Array<{ title: string; publisher: string; url: string }>;
	beat?: InteractiveBeat;
};

const storedDraftFields = {
	title: z.string(),
	precision: z.enum(["day", "month", "year", "approximate"]),
	era: z.enum(["ce", "bce"]),
	exactDate: z.string(),
	year: z.string(),
	month: z.string(),
	day: z.string(),
	summary: z.string(),
	body: z.string(),
	profiles: z.array(z.enum(vakrichtingIds)),
	topics: z.array(z.string()),
	topicLabels: z.record(z.string(), z.string()).default({}),
	sources: z
		.array(
			z.strictObject({
				id: z.string().optional(),
				title: z.string(),
				publisher: z.string(),
				url: z.string(),
			}),
		)
		.min(1),
};

const currentStoredDraftSchema = z.strictObject({
	...storedDraftFields,
	beat: authoringBeatDraftSchema.nullable(),
});

const storedAuthoringDraftSchema = z.union([
	z.strictObject({
		version: z.literal(1),
		step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
		draft: z.object(storedDraftFields),
	}),
	z.strictObject({
		version: z.literal(2),
		step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
		draft: currentStoredDraftSchema,
	}),
	z
		.strictObject({
			version: z.literal(3),
			step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
			draft: currentStoredDraftSchema,
			aiReview: aiDraftReviewSchema.nullable(),
		})
		.superRefine((session, context) => {
			if (!session.aiReview) return;
			const sourceIds = session.draft.sources.map(({ id }) => id);
			if (
				sourceIds.some((id) => !id || id.length > 128) ||
				new Set(sourceIds).size !== sourceIds.length
			) {
				context.addIssue({
					code: "custom",
					path: ["draft", "sources"],
					message: "Bron-ID's moeten ingevuld en uniek zijn.",
				});
			}
		}),
]);

export type StoredAuthoringDraft = {
	draft: AuthoringDraft;
	step: AuthoringStep;
	aiReview: AiDraftReview | null;
};

export function parseStoredAuthoringDraft(
	value: string,
): StoredAuthoringDraft | null {
	try {
		const result = storedAuthoringDraftSchema.safeParse(JSON.parse(value));
		if (!result.success) return null;
		if (result.data.version === 1) {
			return {
				draft: { ...result.data.draft, beat: null },
				step: result.data.step === 3 ? 2 : result.data.step,
				aiReview: null,
			};
		}
		return {
			draft: result.data.draft,
			step: result.data.step === 4 ? 3 : result.data.step,
			aiReview: result.data.version === 3 ? result.data.aiReview : null,
		};
	} catch {
		return null;
	}
}

export function selectStoredAuthoringDraft(
	currentValue: string | null,
	previousValue: string | null,
	legacyValue: string | null = null,
): StoredAuthoringDraft | null {
	for (const value of [currentValue, previousValue, legacyValue]) {
		if (!value) continue;
		const parsed = parseStoredAuthoringDraft(value);
		if (parsed) return parsed;
	}
	return null;
}

export function createInitialAuthoringDraft(): AuthoringDraft {
	return {
		title: "",
		precision: "day",
		era: "ce",
		exactDate: "",
		year: "",
		month: "",
		day: "",
		summary: "",
		body: "",
		profiles: [],
		topics: [],
		topicLabels: {},
		sources: [{ id: "source-1", title: "", publisher: "", url: "" }],
		beat: null,
	};
}

export function toEventDraftInput(draft: AuthoringDraft): EventDraftInput {
	const selectedTopicLabels = Object.fromEntries(
		draft.topics.flatMap((topic) => {
			const label = draft.topicLabels[topic];
			return label ? [[topic, label]] : [];
		}),
	);
	return {
		title: draft.title.trim(),
		date: toHistoricalDate(draft),
		summary: draft.summary.trim(),
		body: draft.body.trim(),
		profiles: draft.profiles,
		topics: draft.topics,
		...(Object.keys(selectedTopicLabels).length > 0
			? { topicLabels: selectedTopicLabels }
			: {}),
		sources: draft.sources.map(({ title, publisher, url }) => ({
			title: title.trim(),
			publisher: publisher.trim(),
			url: url.trim(),
		})),
		...(draft.beat
			? { beat: toCanonicalInteractiveBeat(draft.beat, draft.sources) }
			: {}),
	};
}

export function normalizeTopic(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function addTopicToAuthoringDraft(
	draft: AuthoringDraft,
	label: string,
): AuthoringDraft {
	return addTopic(draft, normalizeTopic(label), label);
}

export function addExistingTopicToAuthoringDraft(
	draft: AuthoringDraft,
	topic: string,
	label: string,
): AuthoringDraft {
	return topicIdPattern.test(topic) ? addTopic(draft, topic, label) : draft;
}

function addTopic(
	draft: AuthoringDraft,
	topic: string,
	label: string,
): AuthoringDraft {
	if (!topic || draft.topics.includes(topic)) return draft;
	const visibleLabel = label.trim();
	const keepLabel =
		visibleLabel !== topic && visibleLabel !== formatEventTag(topic);
	return {
		...draft,
		topics: [...draft.topics, topic],
		topicLabels: keepLabel
			? { ...draft.topicLabels, [topic]: visibleLabel }
			: draft.topicLabels,
	};
}

export function isInitialAuthoringDraft(draft: AuthoringDraft): boolean {
	const initial = createInitialAuthoringDraft();
	return (
		draft.title === initial.title &&
		draft.precision === initial.precision &&
		draft.era === initial.era &&
		draft.exactDate === initial.exactDate &&
		draft.year === initial.year &&
		draft.month === initial.month &&
		draft.day === initial.day &&
		draft.summary === initial.summary &&
		draft.body === initial.body &&
		draft.profiles.length === 0 &&
		draft.topics.length === 0 &&
		Object.keys(draft.topicLabels).length === 0 &&
		draft.sources.length === 1 &&
		draft.sources[0].title === "" &&
		draft.sources[0].publisher === "" &&
		draft.sources[0].url === "" &&
		draft.beat === null
	);
}

export function validateAuthoringStory(
	draft: AuthoringDraft,
): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!draft.title.trim()) errors.title = messages.errors.title;
	if (!draft.summary.trim()) errors.summary = messages.errors.summary;
	if (!draft.body.trim()) errors.body = messages.errors.body;
	if (draft.precision === "day" && draft.era === "ce") {
		if (!draft.exactDate) errors.exactDate = messages.errors.exactDate;
		else if (!parseExactHistoricalDate(draft.exactDate)) {
			errors.exactDate = messages.errors.exactDateFormat;
		}
	}
	if (!(draft.precision === "day" && draft.era === "ce")) {
		const year = Number(draft.year);
		if (!draft.year) errors.year = messages.errors.year;
		else if (!Number.isInteger(year) || year <= 0) {
			errors.year = messages.errors.yearPositive;
		}
	}
	if (
		(draft.precision === "month" ||
			(draft.precision === "day" && draft.era === "bce")) &&
		!draft.month
	) {
		errors.month = messages.errors.month;
	}
	if (draft.precision === "day" && draft.era === "bce") {
		const day = Number(draft.day);
		if (!draft.day) errors.day = messages.errors.day;
		else if (!Number.isInteger(day) || day <= 0) {
			errors.day = messages.errors.dayPositive;
		} else if (
			draft.month &&
			day >
				[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
					Number(draft.month) - 1
				]
		) {
			errors.day = messages.errors.dayImpossible;
		}
	}
	return errors;
}

export function parseExactHistoricalDate(value: string): {
	year: number;
	month: number;
	day: number;
} | null {
	const trimmed = value.trim();
	const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
	const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{1,4})$/.exec(trimmed);
	const parts = iso
		? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
		: local
			? {
					year: Number(local[3]),
					month: Number(local[2]),
					day: Number(local[1]),
				}
			: null;
	if (!parts || parts.year <= 0 || parts.month < 1 || parts.month > 12) {
		return null;
	}
	const maximumDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
		parts.month - 1
	];
	return Number.isInteger(parts.day) &&
		parts.day >= 1 &&
		parts.day <= maximumDay
		? parts
		: null;
}

function toHistoricalDate(draft: AuthoringDraft): HistoricalDate {
	if (draft.precision === "day") {
		if (draft.era === "ce") {
			const date = parseExactHistoricalDate(draft.exactDate);
			return {
				year: date?.year ?? 0,
				era: "ce",
				precision: "day",
				month: date?.month ?? 0,
				day: date?.day ?? 0,
			};
		}
		return {
			year: Number(draft.year),
			era: "bce",
			precision: "day",
			month: Number(draft.month),
			day: Number(draft.day),
		};
	}
	if (draft.precision === "month") {
		return {
			year: Number(draft.year),
			era: draft.era,
			precision: "month",
			month: Number(draft.month),
		};
	}
	return {
		year: Number(draft.year),
		era: draft.era,
		precision: draft.precision,
	};
}
