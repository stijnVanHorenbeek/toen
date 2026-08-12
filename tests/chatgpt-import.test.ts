import { describe, expect, it } from "vitest";
import { toEventDraftInput } from "../src/lib/admin/authoring-draft";
import {
	buildChatGptPrompt,
	CHATGPT_PROMPT_VERSION,
	type ChatGptPromptInput,
} from "../src/lib/admin/chatgpt-prompt";
import {
	CHATGPT_IMPORT_LIMITS,
	parseActiveChatGptRequest,
	parseChatGptResponse,
} from "../src/lib/admin/chatgpt-response";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const activeRequest = { formatVersion: CHATGPT_PROMPT_VERSION, requestId };
const promptInput: ChatGptPromptInput = {
	topic: "De val van Constantinopel",
	lessonContext: "Vergelijk beslissingen onder tijdsdruk.",
	durationMinutes: 8,
	mechanic: "source-duel",
	responseMethod: "response-cards",
	profile: "algemeen",
};

describe("ChatGPT response import", () => {
	it("accepts one raw object or one outer json fence and maps losslessly", () => {
		const response = completeResponse();
		const raw = JSON.stringify(response);

		for (const value of [
			raw,
			`\n\`\`\`json\n${raw}\n\`\`\`\n`,
			`\`\`\`json\r\n${raw}\r\n\`\`\``,
		]) {
			const result = parseChatGptResponse(value, activeRequest);
			expect(result.kind).toBe("ready");
			if (result.kind !== "ready") continue;
			expect(toEventDraftInput(result.draft)).toEqual(asRecord(response).draft);
			expect(result.claims).toHaveLength(1);
			expect(result.draft.sources.map(({ id }) => id)).toEqual([
				"source-1",
				"source-2",
			]);
		}
	});

	it("strictly restores only valid active request metadata", () => {
		expect(parseActiveChatGptRequest(JSON.stringify(activeRequest))).toEqual(
			activeRequest,
		);
		expect(
			parseActiveChatGptRequest(
				JSON.stringify({ ...activeRequest, accessToken: "secret" }),
			),
		).toBeNull();
		expect(parseActiveChatGptRequest("not-json")).toBeNull();
	});

	it("preserves cannot-complete reasons without creating a draft", () => {
		const result = parseChatGptResponse(
			JSON.stringify({
				formatVersion: 1,
				requestId,
				status: "cannot-complete",
				reasons: ["Geen betrouwbare bron-URL beschikbaar."],
			}),
			activeRequest,
		);

		expect(result).toMatchObject({
			kind: "cannot-complete",
			reasons: ["Geen betrouwbare bron-URL beschikbaar."],
			repairPrompt: null,
		});
	});

	it.each([
		[
			"prose",
			`Hier is het antwoord:\n${JSON.stringify(completeResponse())}`,
			"invalid-json",
		],
		["truncation", '{"formatVersion":1', "invalid-json"],
		[
			"second value",
			`${JSON.stringify(completeResponse())}\n{}`,
			"invalid-json",
		],
		["missing fence language", "```\n{}\n```", "invalid-fence"],
		["double fence", "```json\n```json\\n{}\\n```\n```", "invalid-fence"],
		["array root", "[]", "invalid-envelope"],
	] as const)("rejects %s without extracting braces", (_name, raw, code) => {
		expect(parseChatGptResponse(raw, activeRequest)).toMatchObject({
			kind: "error",
			code,
		});
	});

	it("rejects direct, nested, and escaped duplicate keys before JSON.parse", () => {
		for (const raw of [
			'{"formatVersion":1,"formatVersion":1}',
			'{"outer":{"a":1,"a":2}}',
			'{"outer":{"a":1,"\\u0061":2}}',
		]) {
			expect(parseChatGptResponse(raw, activeRequest)).toMatchObject({
				kind: "error",
				code: "duplicate-key",
			});
		}
	});

	it("enforces byte, depth, array, string, and number limits before validation", () => {
		const tooDeep = `${'{"a":'.repeat(CHATGPT_IMPORT_LIMITS.depth + 1)}null${"}".repeat(CHATGPT_IMPORT_LIMITS.depth + 1)}`;
		const tooManyItems = JSON.stringify({
			a: Array.from(
				{ length: CHATGPT_IMPORT_LIMITS.arrayItems + 1 },
				(_, index) => index,
			),
		});
		const tooLongString = JSON.stringify({
			a: "x".repeat(CHATGPT_IMPORT_LIMITS.stringLength + 1),
		});
		const tooLongNumber = `{"a":${"1".repeat(CHATGPT_IMPORT_LIMITS.numberLength + 1)}}`;
		const tooManyBytes = JSON.stringify({
			a: "é".repeat(CHATGPT_IMPORT_LIMITS.bytes),
		});

		for (const [raw, code] of [
			[tooDeep, "too-deep"],
			[tooManyItems, "too-many-values"],
			[tooLongString, "string-too-long"],
			[tooLongNumber, "number-too-long"],
			[tooManyBytes, "too-large"],
		] as const) {
			expect(parseChatGptResponse(raw, activeRequest)).toMatchObject({
				kind: "error",
				code,
			});
		}
	});

	it("enforces remaining value, member, key, decoded-string, and Unicode limits", () => {
		const tooManyValues = JSON.stringify(
			Object.fromEntries(
				Array.from({ length: 33 }, (_, index) => [
					`items${index}`,
					Array.from({ length: 64 }, (__, item) => item),
				]),
			),
		);
		const memberHeavyObject = Object.fromEntries(
			Array.from({ length: 17 }, (_, index) => [`field${index}`, index]),
		);
		const tooManyMembers = JSON.stringify({
			items: Array.from({ length: 64 }, () => memberHeavyObject),
		});
		const tooManyMembersInOneObject = JSON.stringify(
			Object.fromEntries(
				Array.from(
					{ length: CHATGPT_IMPORT_LIMITS.objectMembersPerObject + 1 },
					(_, index) => [`field${index}`, index],
				),
			),
		);
		const tooLongKey = JSON.stringify({
			["k".repeat(CHATGPT_IMPORT_LIMITS.keyLength + 1)]: true,
		});
		const tooManyDecodedStringBytes = JSON.stringify({
			values: ["a".repeat(17_000), "b".repeat(17_000), "c".repeat(17_000)],
		});

		for (const [raw, code] of [
			[tooManyValues, "too-many-values"],
			[tooManyMembers, "too-many-values"],
			[tooManyMembersInOneObject, "too-many-values"],
			[tooLongKey, "string-too-long"],
			[tooManyDecodedStringBytes, "string-too-long"],
			['{"value":"\\uD800"}', "invalid-json"],
		] as const) {
			expect(parseChatGptResponse(raw, activeRequest)).toMatchObject({
				kind: "error",
				code,
			});
		}
	});

	it("rejects forbidden and unknown keys including escaped prototype keys", () => {
		for (const raw of [
			'{"\\u005f_prot\\u006f__":{}}',
			JSON.stringify({
				...asRecord(completeResponse()),
				slug: "verborgen-pad",
			}),
			JSON.stringify({
				...asRecord(completeResponse()),
				accessToken: "geheim",
			}),
		]) {
			const result = parseChatGptResponse(raw, activeRequest);
			expect(result.kind).toBe("error");
			expect(
				result.kind === "error" &&
					["forbidden-key", "invalid-envelope"].includes(result.code),
			).toBe(true);
		}
	});

	it("rejects unsupported versions and stale or missing requests", () => {
		const unsupported = completeResponse();
		asRecord(unsupported).formatVersion = 2;
		const stale = completeResponse();
		asRecord(stale).requestId = "123e4567-e89b-42d3-a456-426614174111";

		expect(
			parseChatGptResponse(JSON.stringify(unsupported), activeRequest),
		).toMatchObject({ kind: "error", code: "unsupported-version" });
		expect(
			parseChatGptResponse(JSON.stringify(stale), activeRequest),
		).toMatchObject({ kind: "error", code: "stale-request" });
		expect(
			parseChatGptResponse(JSON.stringify(completeResponse()), null),
		).toMatchObject({ kind: "error", code: "missing-request" });
	});

	it.each([
		[
			"unknown draft field",
			(response: unknown) => {
				asRecord(asRecord(response).draft).extra = "niet toegestaan";
			},
		],
		[
			"unknown profile",
			(response: unknown) => {
				asRecord(asRecord(response).draft).profiles = ["onbekend"];
			},
		],
		[
			"unsafe Markdown",
			(response: unknown) => {
				asRecord(asRecord(response).draft).body =
					'<img src=x onerror="alert(1)">';
			},
		],
		[
			"unsafe source URL",
			(response: unknown) => {
				const sources = asRecord(asRecord(response).draft).sources as unknown[];
				asRecord(sources[0]).url = "javascript:alert(1)";
			},
		],
		[
			"unknown mechanic",
			(response: unknown) => {
				asRecord(asRecord(asRecord(response).draft).beat).mechanic = "quiz";
			},
		],
		[
			"invalid route",
			(response: unknown) => {
				const routes = asRecord(asRecord(asRecord(response).draft).beat)
					.routes as unknown[];
				asRecord(routes[0]).stageIds = ["opening", "commitment"];
			},
		],
		[
			"unlisted claim source",
			(response: unknown) => {
				const claims = asRecord(response).claims as unknown[];
				asRecord(claims[0]).sourceUrls = ["https://example.org/not-listed"];
			},
		],
		[
			"XSS title",
			(response: unknown) => {
				asRecord(asRecord(response).draft).title = "<script>alert(1)</script>";
			},
		],
	] as const)("strictly rejects %s", (_name, mutate) => {
		const response = completeResponse();
		mutate(response);
		expect(
			parseChatGptResponse(JSON.stringify(response), activeRequest),
		).toMatchObject({
			kind: "error",
		});
	});

	it("rejects canonical routes that cannot round-trip through constrained authoring", () => {
		const response = completeResponse();
		const beat = asRecord(asRecord(response).draft).beat;
		const routes = asRecord(beat).routes as unknown[];
		const route8 = asRecord(routes[1]).stageIds as string[];
		const route12 = asRecord(routes[2]).stageIds as string[];
		asRecord(routes[1]).stageIds = route8.filter((id) => id !== "reasoning");
		asRecord(routes[2]).stageIds = route12;

		expect(
			parseChatGptResponse(JSON.stringify(response), activeRequest),
		).toMatchObject({ kind: "error", code: "unsupported-structure" });
	});

	it("builds deterministic repair instructions without echoing hostile paste", () => {
		const hostile = `vooraf <script>alert(1)</script> ${"x".repeat(200)}`;
		const first = parseChatGptResponse(hostile, activeRequest);
		const second = parseChatGptResponse(hostile, activeRequest);

		expect(first).toMatchObject({ kind: "error", code: "invalid-json" });
		if (first.kind !== "error" || second.kind !== "error") return;
		expect(first.repairPrompt).toBe(second.repairPrompt);
		expect(first.repairPrompt).toContain(requestId);
		expect(first.repairPrompt).not.toContain("<script>");
		expect(first.repairPrompt).not.toContain("x".repeat(50));
	});

	it("maps every canonical mechanic into editable fields without route loss", () => {
		for (const mechanic of [
			"vote-revote",
			"source-duel",
			"context-decision",
		] as const) {
			const response = completeResponse(mechanic);
			const result = parseChatGptResponse(
				JSON.stringify(response),
				activeRequest,
			);
			expect(result.kind).toBe("ready");
			if (result.kind !== "ready") continue;
			expect(result.draft.beat?.mechanic).toBe(mechanic);
			expect(toEventDraftInput(result.draft).beat?.mechanic).toBe(mechanic);
		}
	});

	it("maps every canonical date precision into editable fields", () => {
		for (const [date, expected] of [
			[
				{ year: 44, era: "bce", precision: "day", month: 3, day: 15 },
				{ precision: "day", era: "bce", year: "44", month: "3", day: "15" },
			],
			[
				{ year: 1918, era: "ce", precision: "month", month: 11 },
				{ precision: "month", era: "ce", year: "1918", month: "11" },
			],
			[
				{ year: 753, era: "bce", precision: "year" },
				{ precision: "year", era: "bce", year: "753" },
			],
			[
				{ year: 1200, era: "ce", precision: "approximate" },
				{ precision: "approximate", era: "ce", year: "1200" },
			],
		] as const) {
			const response = completeResponse();
			asRecord(asRecord(response).draft).date = date;
			const result = parseChatGptResponse(
				JSON.stringify(response),
				activeRequest,
			);
			expect(result.kind).toBe("ready");
			if (result.kind === "ready") expect(result.draft).toMatchObject(expected);
		}
	});
});

function completeResponse(
	mechanic: ChatGptPromptInput["mechanic"] = promptInput.mechanic,
): unknown {
	const prompt = buildChatGptPrompt({ ...promptInput, mechanic }, requestId);
	const match =
		/Gebruik bij succes exact deze envelop en vul alle voorbeeldtekst inhoudelijk in:\n([\s\S]*?)\n\nREGELS VOOR HET OBJECT/.exec(
			prompt,
		);
	if (!match) throw new Error("Complete response example missing from prompt");
	return JSON.parse(match[1]);
}

function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Expected record in test fixture");
	}
	return value as Record<string, unknown>;
}
