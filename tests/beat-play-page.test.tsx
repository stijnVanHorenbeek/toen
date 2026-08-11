import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const getEventBySlug = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/events", () => ({
	getAllEvents: vi.fn(),
	getEventBySlug,
}));

import BeatPlayPage from "../src/app/events/[slug]/play/page";

describe("classroom beat route", () => {
	it("keeps a legacy article available when it has no beat", async () => {
		getEventBySlug.mockResolvedValue({
			slug: "legacy-event-1900",
			title: "Legacy event",
			summary: "Event without a classroom activity.",
			sources: [],
			beat: undefined,
		});
		const page = await BeatPlayPage({
			params: Promise.resolve({ slug: "legacy-event-1900" }),
		});
		const markup = renderToStaticMarkup(page);

		expect(markup).toContain("Legacy event");
		expect(markup).toContain('href="/events/legacy-event-1900"');
	});
});
