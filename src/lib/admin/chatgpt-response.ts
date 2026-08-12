import { z } from "zod";
import type { HistoricalDate, InteractiveBeat } from "../content/event";
import { eventDraftInputSchema } from "../content/event-draft";
import { messages } from "../i18n/messages.nl-BE";
import type { AuthoringBeatDraft, AuthoringBeatStage } from "./authoring-beat";
import {
	type AuthoringDraft,
	type EventDraftInput,
	toEventDraftInput,
} from "./authoring-draft";
import { CHATGPT_PROMPT_VERSION } from "./chatgpt-prompt";

export const CHATGPT_IMPORT_LIMITS = {
	bytes: 65_536,
	depth: 32,
	values: 2_048,
	objectMembers: 1_024,
	objectMembersPerObject: 128,
	arrayItems: 64,
	keyLength: 128,
	stringLength: 20_000,
	totalStringBytes: 49_152,
	numberLength: 32,
} as const;

export type ActiveChatGptRequest = {
	formatVersion: typeof CHATGPT_PROMPT_VERSION;
	requestId: string;
};

export type ChatGptClaim = {
	text: string;
	sourceUrls: string[];
	uncertainty: string | null;
};

export type ChatGptImportErrorCode =
	| "invalid-fence"
	| "invalid-json"
	| "invalid-envelope"
	| "duplicate-key"
	| "forbidden-key"
	| "too-large"
	| "too-deep"
	| "too-many-values"
	| "string-too-long"
	| "number-too-long"
	| "unsupported-version"
	| "missing-request"
	| "stale-request"
	| "invalid-markdown"
	| "invalid-claims"
	| "unsafe-content"
	| "unsupported-structure";

export type ChatGptImportResult =
	| {
			kind: "ready";
			draft: AuthoringDraft;
			claims: ChatGptClaim[];
			requestId: string;
	  }
	| {
			kind: "cannot-complete";
			reasons: string[];
			repairPrompt: null;
	  }
	| {
			kind: "error";
			code: ChatGptImportErrorCode;
			message: string;
			repairPrompt: string | null;
	  };

const claimSchema = z.strictObject({
	text: z.string().trim().min(1).max(1_000),
	sourceUrls: z.array(z.string().max(2_048)).min(1).max(16),
	uncertainty: z.string().trim().min(1).max(500).nullable(),
});

const importedDraftSchema = eventDraftInputSchema.superRefine(
	(draft, context) => {
		if (draft.beat?.version !== 2) {
			context.addIssue({
				code: "custom",
				path: ["beat"],
				message: "Klasactiviteit versie 2 is verplicht.",
			});
		}
		if (draft.title.length > 160) {
			context.addIssue({
				code: "custom",
				path: ["title"],
				message: "Te lang.",
			});
		}
		if (draft.summary.length > 500) {
			context.addIssue({
				code: "custom",
				path: ["summary"],
				message: "Te lang.",
			});
		}
		if (draft.body.length > 20_000) {
			context.addIssue({ code: "custom", path: ["body"], message: "Te lang." });
		}
		if (draft.sources.length > 16 || draft.topics.length > 16) {
			context.addIssue({ code: "custom", path: [], message: "Te veel items." });
		}
		if (new Set(draft.topics).size !== draft.topics.length) {
			context.addIssue({
				code: "custom",
				path: ["topics"],
				message: "Onderwerpen moeten uniek zijn.",
			});
		}
		if (new Set(draft.profiles).size !== draft.profiles.length) {
			context.addIssue({
				code: "custom",
				path: ["profiles"],
				message: "Vakrichtingen moeten uniek zijn.",
			});
		}
		for (const [index, source] of draft.sources.entries()) {
			if (
				source.title.length <= 240 &&
				source.publisher.length <= 160 &&
				source.url.length <= 2_048
			) {
				continue;
			}
			context.addIssue({
				code: "custom",
				path: ["sources", index],
				message: "Bron is te lang.",
			});
		}
	},
);

const completeEnvelopeSchema = z
	.strictObject({
		formatVersion: z.literal(CHATGPT_PROMPT_VERSION),
		requestId: z.uuid(),
		status: z.literal("complete"),
		draft: importedDraftSchema,
		claims: z.array(claimSchema).min(1).max(64),
	})
	.superRefine((value, context) => {
		const sourceUrls = new Set(value.draft.sources.map(({ url }) => url));
		for (const [claimIndex, claim] of value.claims.entries()) {
			if (new Set(claim.sourceUrls).size !== claim.sourceUrls.length) {
				context.addIssue({
					code: "custom",
					path: ["claims", claimIndex, "sourceUrls"],
					message: "Bronnen bij een bewering moeten uniek zijn.",
				});
			}
			for (const [sourceIndex, sourceUrl] of claim.sourceUrls.entries()) {
				if (sourceUrls.has(sourceUrl)) continue;
				context.addIssue({
					code: "custom",
					path: ["claims", claimIndex, "sourceUrls", sourceIndex],
					message: "Bewering verwijst naar een onbekende bron.",
				});
			}
		}
	});

const cannotCompleteEnvelopeSchema = z.strictObject({
	formatVersion: z.literal(CHATGPT_PROMPT_VERSION),
	requestId: z.uuid(),
	status: z.literal("cannot-complete"),
	reasons: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
});

const activeRequestSchema = z.strictObject({
	formatVersion: z.literal(CHATGPT_PROMPT_VERSION),
	requestId: z.uuid(),
});

const forbiddenKeys = new Set([
	"__proto__",
	"prototype",
	"constructor",
	"slug",
	"canonicalpath",
	"repository",
	"git",
	"credentials",
	"accesstoken",
	"apikey",
	"password",
	"teachername",
	"studentname",
]);
const unsafeTextPattern =
	/<\s*\/?\s*(?:script|iframe|object|embed|svg|img|style|link|meta)\b|javascript\s*:/i;

export function parseActiveChatGptRequest(
	value: string | null,
): ActiveChatGptRequest | null {
	if (!value) return null;
	try {
		return activeRequestSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

export function parseChatGptResponse(
	raw: string,
	activeRequest: ActiveChatGptRequest | null,
): ChatGptImportResult {
	let source: string;
	try {
		source = unwrapResponse(raw);
		preflightJson(source);
	} catch (error) {
		return importError(
			error instanceof JsonPreflightError ? error.code : "invalid-json",
			activeRequest,
		);
	}

	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch {
		return importError("invalid-json", activeRequest);
	}
	if (!isRecord(value)) return importError("invalid-envelope", activeRequest);
	if (value.formatVersion !== CHATGPT_PROMPT_VERSION) {
		return importError("unsupported-version", activeRequest);
	}
	if (!activeRequest) return importError("missing-request", null);
	if (
		activeRequest.formatVersion !== CHATGPT_PROMPT_VERSION ||
		value.requestId !== activeRequest.requestId
	) {
		return importError("stale-request", activeRequest);
	}

	if (value.status === "cannot-complete") {
		const parsed = cannotCompleteEnvelopeSchema.safeParse(value);
		if (!parsed.success) return importError("invalid-envelope", activeRequest);
		return {
			kind: "cannot-complete",
			reasons: parsed.data.reasons,
			repairPrompt: null,
		};
	}
	if (value.status !== "complete") {
		return importError("invalid-envelope", activeRequest);
	}

	const parsed = completeEnvelopeSchema.safeParse(value);
	if (!parsed.success) {
		const issuePaths = parsed.error.issues.map(({ path }) => path.join("."));
		const code = issuePaths.some((path) => path.startsWith("draft.body"))
			? "invalid-markdown"
			: issuePaths.some((path) => path.startsWith("claims"))
				? "invalid-claims"
				: "invalid-envelope";
		return importError(code, activeRequest);
	}

	const canonicalDraft = parsed.data.draft as EventDraftInput;
	const draft = toAuthoringDraft(canonicalDraft);
	if (
		!draft ||
		!deepEqual(normalizeCanonical(canonicalDraft), toEventDraftInput(draft))
	) {
		return importError("unsupported-structure", activeRequest);
	}
	return {
		kind: "ready",
		draft,
		claims: parsed.data.claims,
		requestId: parsed.data.requestId,
	};
}

function unwrapResponse(raw: string): string {
	if (new TextEncoder().encode(raw).byteLength > CHATGPT_IMPORT_LIMITS.bytes) {
		throw new JsonPreflightError("too-large");
	}
	const trimmed = raw.trim();
	if (!trimmed) throw new JsonPreflightError("invalid-json");
	if (!trimmed.startsWith("```")) return trimmed;
	const match = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed);
	if (!match || match[1].includes("```")) {
		throw new JsonPreflightError("invalid-fence");
	}
	return match[1];
}

function preflightJson(source: string): void {
	let index = 0;
	let values = 0;
	let objectMembers = 0;
	let totalStringBytes = 0;

	function fail(code: ChatGptImportErrorCode): never {
		throw new JsonPreflightError(code);
	}
	function skipWhitespace() {
		while (
			index < source.length &&
			(source[index] === " " ||
				source[index] === "\t" ||
				source[index] === "\n" ||
				source[index] === "\r")
		) {
			index += 1;
		}
	}
	function parseString(isKey: boolean): string {
		const start = index;
		index += 1;
		while (index < source.length) {
			const character = source[index];
			if (character === '"') {
				index += 1;
				let decoded: string;
				try {
					decoded = JSON.parse(source.slice(start, index));
				} catch {
					return fail("invalid-json");
				}
				if (hasUnpairedSurrogate(decoded)) return fail("invalid-json");
				if (decoded.length > CHATGPT_IMPORT_LIMITS.stringLength) {
					return fail("string-too-long");
				}
				if (isKey && decoded.length > CHATGPT_IMPORT_LIMITS.keyLength) {
					return fail("string-too-long");
				}
				totalStringBytes += new TextEncoder().encode(decoded).byteLength;
				if (totalStringBytes > CHATGPT_IMPORT_LIMITS.totalStringBytes) {
					return fail("string-too-long");
				}
				if (isKey && forbiddenKeys.has(decoded.toLowerCase())) {
					return fail("forbidden-key");
				}
				if (!isKey && unsafeTextPattern.test(decoded)) {
					return fail("unsafe-content");
				}
				return decoded;
			}
			if (character === "\\") {
				index += 2;
				continue;
			}
			if (character.charCodeAt(0) < 0x20) return fail("invalid-json");
			index += 1;
		}
		return fail("invalid-json");
	}
	function parseNumber() {
		const match = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
			source.slice(index),
		);
		if (match?.index !== 0) return fail("invalid-json");
		if (match[0].length > CHATGPT_IMPORT_LIMITS.numberLength) {
			return fail("number-too-long");
		}
		index += match[0].length;
	}
	function parseObject(depth: number) {
		if (depth >= CHATGPT_IMPORT_LIMITS.depth) return fail("too-deep");
		index += 1;
		skipWhitespace();
		if (source[index] === "}") {
			index += 1;
			return;
		}
		const keys = new Set<string>();
		let members = 0;
		while (index < source.length) {
			if (source[index] !== '"') return fail("invalid-json");
			const key = parseString(true);
			if (keys.has(key)) return fail("duplicate-key");
			keys.add(key);
			members += 1;
			objectMembers += 1;
			if (
				members > CHATGPT_IMPORT_LIMITS.objectMembersPerObject ||
				objectMembers > CHATGPT_IMPORT_LIMITS.objectMembers
			) {
				return fail("too-many-values");
			}
			skipWhitespace();
			if (source[index] !== ":") return fail("invalid-json");
			index += 1;
			parseValue(depth + 1);
			skipWhitespace();
			if (source[index] === "}") {
				index += 1;
				return;
			}
			if (source[index] !== ",") return fail("invalid-json");
			index += 1;
			skipWhitespace();
		}
		return fail("invalid-json");
	}
	function parseArray(depth: number) {
		if (depth >= CHATGPT_IMPORT_LIMITS.depth) return fail("too-deep");
		index += 1;
		skipWhitespace();
		if (source[index] === "]") {
			index += 1;
			return;
		}
		let items = 0;
		while (index < source.length) {
			items += 1;
			if (items > CHATGPT_IMPORT_LIMITS.arrayItems) {
				return fail("too-many-values");
			}
			parseValue(depth + 1);
			skipWhitespace();
			if (source[index] === "]") {
				index += 1;
				return;
			}
			if (source[index] !== ",") return fail("invalid-json");
			index += 1;
			skipWhitespace();
		}
		return fail("invalid-json");
	}
	function parseValue(depth: number) {
		skipWhitespace();
		values += 1;
		if (values > CHATGPT_IMPORT_LIMITS.values) return fail("too-many-values");
		const character = source[index];
		if (character === "{") return parseObject(depth);
		if (character === "[") return parseArray(depth);
		if (character === '"') {
			parseString(false);
			return;
		}
		if (character === "-" || (character >= "0" && character <= "9")) {
			parseNumber();
			return;
		}
		for (const literal of ["true", "false", "null"]) {
			if (!source.startsWith(literal, index)) continue;
			index += literal.length;
			return;
		}
		return fail("invalid-json");
	}

	parseValue(0);
	skipWhitespace();
	if (index !== source.length) fail("invalid-json");
}

function toAuthoringDraft(canonical: EventDraftInput): AuthoringDraft | null {
	if (canonical.beat?.version !== 2) return null;
	const sources = canonical.sources.map((source, index) => ({
		...source,
		id: `source-${index + 1}`,
	}));
	const sourceIdByUrl = new Map(sources.map(({ id, url }) => [url, id]));
	const beat = toAuthoringBeat(canonical.beat, sourceIdByUrl);
	if (!beat) return null;
	return {
		title: canonical.title,
		...toAuthoringDate(canonical.date),
		summary: canonical.summary,
		body: canonical.body,
		profiles: canonical.profiles,
		topics: canonical.topics,
		topicLabels: canonical.topicLabels ?? {},
		sources,
		beat,
	};
}

function toAuthoringDate(
	date: HistoricalDate,
): Pick<
	AuthoringDraft,
	"precision" | "era" | "exactDate" | "year" | "month" | "day"
> {
	const common = {
		precision: date.precision,
		era: date.era,
		exactDate: "",
		year: "",
		month: "",
		day: "",
	};
	if (date.precision === "day" && date.era === "ce") {
		return {
			...common,
			exactDate: `${String(date.day).padStart(2, "0")}.${String(date.month).padStart(2, "0")}.${date.year}`,
		};
	}
	return {
		...common,
		year: String(date.year),
		...(date.precision === "day" || date.precision === "month"
			? { month: String(date.month) }
			: {}),
		...(date.precision === "day" ? { day: String(date.day) } : {}),
	};
}

function toAuthoringBeat(
	beat: Extract<InteractiveBeat, { version: 2 }>,
	sourceIdByUrl: Map<string, string>,
): AuthoringBeatDraft | null {
	const sourceId = (url: string) => sourceIdByUrl.get(url) ?? "";
	const earliestRoute = (stageId: string): 5 | 8 | 12 | null =>
		beat.routes.find(({ stageIds }) => stageIds.includes(stageId))
			?.durationMinutes ?? null;
	const stages: AuthoringBeatStage[] = [];
	for (const stage of beat.stages) {
		const common = {
			id: stage.id,
			phase: stage.phase,
			suggestedSeconds: String(stage.suggestedSeconds),
			teacherPrompt: stage.teacherPrompt,
			expectedStudentAction: stage.expectedStudentAction,
		};
		switch (stage.phase) {
			case "opening":
				stages.push({ ...common, phase: "opening", stimulus: stage.stimulus });
				break;
			case "commitment":
			case "revision":
			case "reasoning":
				stages.push({ ...common, phase: stage.phase, prompt: stage.prompt });
				break;
			case "evidence":
				stages.push({
					...common,
					phase: "evidence",
					title: stage.title,
					evidence: stage.evidence,
					sourceId: sourceId(stage.sourceUrl),
					earliestDurationMinutes: stage.earliestDurationMinutes,
				});
				break;
			case "discussion": {
				const earliestDurationMinutes = earliestRoute(stage.id);
				if (!earliestDurationMinutes) return null;
				stages.push({
					...common,
					phase: "discussion",
					prompt: stage.prompt,
					sentenceStarter: stage.sentenceStarter ?? "",
					earliestDurationMinutes,
				});
				break;
			}
			case "resolution":
				stages.push({
					...common,
					phase: "resolution",
					title: stage.title,
					feedback: stage.feedback,
					misconception: stage.misconception ?? "",
					sourceIds: stage.sourceUrls.map(sourceId),
				});
				break;
			case "lesson-bridge":
				stages.push({
					...common,
					phase: "lesson-bridge",
					bridge: stage.bridge,
				});
				break;
		}
	}
	const sourceIds = [...sourceIdByUrl.values()];
	const sourceCards =
		beat.mechanic === "source-duel"
			? (beat.sourceCards.map((card) => ({
					id: card.id,
					label: card.label,
					excerpt: card.excerpt,
					sourceId: sourceId(card.sourceUrl),
				})) as AuthoringBeatDraft["sourceCards"])
			: ([
					{
						id: "source-a",
						label: "Bron A",
						excerpt: "",
						sourceId: sourceIds[0] ?? "",
					},
					{
						id: "source-b",
						label: "Bron B",
						excerpt: "",
						sourceId: sourceIds[1] ?? sourceIds[0] ?? "",
					},
				] as AuthoringBeatDraft["sourceCards"]);
	return {
		version: 2,
		mechanic: beat.mechanic,
		responseMethod: beat.responseMethod,
		vocationalConnection: beat.vocationalConnection ?? "",
		question: beat.question,
		choices: beat.choices,
		stages,
		sensitivityNotes: beat.sensitivityNotes ?? [],
		perspective: beat.mechanic === "context-decision" ? beat.perspective : "",
		sourceCards,
	};
}

function normalizeCanonical(value: EventDraftInput): EventDraftInput {
	if (value.topicLabels && Object.keys(value.topicLabels).length === 0) {
		const { topicLabels: _empty, ...rest } = value;
		return rest;
	}
	return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return (
			Array.isArray(left) &&
			Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => deepEqual(value, right[index]))
		);
	}
	if (!isRecord(left) || !isRecord(right)) return false;
	const leftKeys = Object.keys(left).sort();
	const rightKeys = Object.keys(right).sort();
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key, index) =>
				key === rightKeys[index] && deepEqual(left[key], right[key]),
		)
	);
}

function buildRepairPrompt(
	code: ChatGptImportErrorCode,
	activeRequest: ActiveChatGptRequest,
): string {
	return `Herstel je vorige antwoord in hetzelfde ChatGPT-gesprek.

Probleem: ${errorMessage(code)}
Gebruik formatVersion ${CHATGPT_PROMPT_VERSION} en requestId "${activeRequest.requestId}" exact.
Geef uitsluitend één volledig rauw JSON-object zonder codeblok of uitleg.
Behoud alleen gecontroleerde bron-URL's en verzin geen bron, citaat, feit of afbeelding.
Als je het antwoord niet veilig en volledig kunt herstellen, geef status "cannot-complete" met concrete Nederlandse redenen.`;
}

function importError(
	code: ChatGptImportErrorCode,
	activeRequest: ActiveChatGptRequest | null,
): Extract<ChatGptImportResult, { kind: "error" }> {
	return {
		kind: "error",
		code,
		message: errorMessage(code),
		repairPrompt: activeRequest ? buildRepairPrompt(code, activeRequest) : null,
	};
}

function errorMessage(code: ChatGptImportErrorCode): string {
	return messages.admin.chatGpt.importErrors[code];
}

function hasUnpairedSurrogate(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff)
				return true;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			return true;
		}
	}
	return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

class JsonPreflightError extends Error {
	constructor(readonly code: ChatGptImportErrorCode) {
		super(code);
	}
}
