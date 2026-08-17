import { expect, it, vi } from "vitest";
import { handlePreviewEventRequest } from "../src/lib/admin/preview-event-handler";
import { beatSources, voteRevoteBeat } from "./fixtures/interactive-beat";

const environment = {
	ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
	ACCESS_POLICY_AUD: "application-audience",
};
const authenticate = vi.fn().mockResolvedValue({ email: "editor@example.com" });

function POST(request: Request) {
	const headers = new Headers(request.headers);
	headers.set("Origin", new URL(request.url).origin);
	return handlePreviewEventRequest(
		new Request(request, { headers }),
		environment,
		{
			authenticate,
		},
	);
}

it("rejects unknown top-level fields", async () => {
	const response = await POST(
		new Request("https://example.com/api/admin/events/preview", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Test",
				date: { year: 1969, era: "ce", precision: "year" },
				summary: "Samenvatting",
				body: "Verhaal",
				profiles: ["algemeen"],
				topics: ["wetenschap"],
				sources: beatSources,
				unexpectedAdminField: true,
			}),
		}),
	);
	expect(response.status).toBe(400);
	await expect(response.json()).resolves.toMatchObject({
		code: "invalid_event",
	});
});

it("returns stable codes and field issues for an invalid draft", async () => {
	const response = await POST(
		new Request("https://example.com/api/admin/events/preview", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "" }),
		}),
	);

	expect(response.status).toBe(400);
	await expect(response.json()).resolves.toMatchObject({
		code: "invalid_event",
		error: "Controleer de gemarkeerde velden.",
		issues: expect.arrayContaining([
			expect.objectContaining({ field: "title", message: "Vul een titel in." }),
		]),
	});
});

it("returns a Dutch field issue for invalid version 2 activity content", async () => {
	const response = await POST(
		new Request("https://example.com/api/admin/events/preview", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Test",
				date: { year: 1969, era: "ce", precision: "year" },
				summary: "Samenvatting",
				body: "Verhaal",
				profiles: ["algemeen"],
				topics: ["wetenschap"],
				sources: beatSources,
				beat: {
					...voteRevoteBeat,
					version: 2,
					responseMethod: "response-cards",
					question: "",
				},
			}),
		}),
	);

	expect(response.status).toBe(400);
	await expect(response.json()).resolves.toMatchObject({
		issues: expect.arrayContaining([
			expect.objectContaining({
				field: "beat.question",
				message: "Vul de centrale vraag in.",
			}),
		]),
	});
});

it("rejects unsafe Markdown submitted outside the editor", async () => {
	const response = await POST(
		new Request("https://example.com/api/admin/events/preview", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Test",
				date: { year: 1500, era: "ce", precision: "day", month: 2, day: 29 },
				summary: "Samenvatting",
				body: "[onveilig](javascript:alert(1))",
				profiles: ["algemeen"],
				topics: ["politiek"],
				sources: [
					{ title: "Bron", publisher: "Uitgever", url: "https://example.org" },
				],
			}),
		}),
	);

	expect(response.status).toBe(400);
	await expect(response.json()).resolves.toMatchObject({
		issues: expect.arrayContaining([
			expect.objectContaining({ field: "body" }),
		]),
	});
});

it("returns a source field issue for a malformed URL", async () => {
	const response = await POST(
		new Request("https://example.com/api/admin/events/preview", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "Test",
				date: { year: 1500, era: "ce", precision: "day", month: 2, day: 29 },
				summary: "Samenvatting",
				body: "Verhaal",
				profiles: ["algemeen"],
				topics: ["politiek"],
				sources: [{ title: "Bron", publisher: "Uitgever", url: "geen-url" }],
			}),
		}),
	);

	expect(response.status).toBe(400);
	await expect(response.json()).resolves.toMatchObject({
		issues: expect.arrayContaining([
			expect.objectContaining({
				field: "sources.0.url",
				message:
					"Vul een geldige URL in, bijvoorbeeld https://example.org/bron.",
			}),
		]),
	});
});
