import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BeatPlayPage from "../src/app/events/[slug]/play/page";

describe("classroom beat route", () => {
	it("keeps a legacy article available when it has no beat", async () => {
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
