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
			slug: "val-van-constantinopel-1453",
			title: "Constantinopel valt",
			summary: "Ottomaanse troepen nemen Constantinopel in.",
			sources: [],
			beat: undefined,
		});
		const page = await BeatPlayPage({
			params: Promise.resolve({ slug: "val-van-constantinopel-1453" }),
		});
		const markup = renderToStaticMarkup(page);

		expect(markup).toContain("Deze activiteit is nog niet beschikbaar");
		expect(markup).toContain("Constantinopel valt");
		expect(markup).toContain('href="/events/val-van-constantinopel-1453"');
		expect(markup).toContain("Lees het verhaal");
	});
});
