import { describe, expect, it } from "vitest";
import {
	compareLocalized,
	formatEventTag,
	formatNumber,
	formatSourceLabel,
	formatVakrichting,
	primaryLocale,
} from "../src/lib/i18n/locale";
import { messages } from "../src/lib/i18n/messages.nl-BE";

describe("Belgian Dutch locale", () => {
	it("uses nl-BE and keeps stable identifiers separate from labels", () => {
		expect(primaryLocale).toBe("nl-BE");
		expect(formatVakrichting("auto-mechanica")).toBe("Auto & mechanica");
		expect(formatVakrichting("logistiek-transport")).toBe(
			"Logistiek & transport",
		);
		expect(formatEventTag("belgie")).toBe("België");
		expect(formatSourceLabel("title", 2)).toBe("Titel van bron 2");
		expect(["zebra", "äbc"].sort(compareLocalized)).toEqual(["äbc", "zebra"]);
		expect(formatNumber(1234)).toBe("1.234");
	});

	it("provides typed student, teacher, and validation copy", () => {
		expect(messages.home.title).toBe("Het verleden begon niet gisteren.");
		expect(messages.admin.title).toBe("Nieuwe gebeurtenis");
		expect(messages.errors.previewFailed).toContain("voorbeeld");
		expect(messages.event.sources).toBe("Bronnen");
	});
});
