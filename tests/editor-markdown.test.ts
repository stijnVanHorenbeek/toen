import { describe, expect, it } from "vitest";
import {
	getEditorHeadingTags,
	isSafeEditorLink,
	isSupportedEditorMarkdown,
	normalizeEditorMarkdown,
} from "../src/lib/content/editor-markdown";

describe("visual-editor Markdown", () => {
	it("round-trips the complete supported subset deterministically", () => {
		const markdown = `Een **vet**, *cursief* en ***vet cursief*** begin met [een bron](https://example.org).\n\n## Gevolgen\n\n### Vandaag\n\n- Eén\n- Twee\n\n1. Eerst\n2. Daarna\n\n> Een citaat\n`;

		expect(normalizeEditorMarkdown(markdown)).toBe(markdown);
	});

	it("accepts soft and hard breaks only when the editor round-trips them", () => {
		for (const markdown of [
			"Eerste regel\ntweede regel\n",
			"Eerste regel  \ntweede regel\n",
		]) {
			expect(isSupportedEditorMarkdown(markdown)).toBe(
				normalizeEditorMarkdown(markdown).trimEnd() === markdown.trimEnd(),
			);
		}
	});

	it("accepts only HTTP links", () => {
		expect(isSafeEditorLink("https://example.org/bron")).toBe(true);
		expect(isSafeEditorLink("http://example.org/bron")).toBe(true);
		expect(isSafeEditorLink("javascript:alert(1)")).toBe(false);
		expect(isSafeEditorLink("geen-url")).toBe(false);
	});

	it("creates heading nodes only for H2 and H3", () => {
		const markdown =
			"# Geen paginatitel\n\n## Tussenkop\n\n### Subkop\n\n#### Geen diepe kop\n";
		expect(getEditorHeadingTags(markdown)).toEqual(["h2", "h3"]);
		expect(normalizeEditorMarkdown(markdown)).toBe(markdown);
		expect(isSupportedEditorMarkdown(markdown)).toBe(false);
	});

	it("accepts only the canonical hard line break syntax", () => {
		expect(isSupportedEditorMarkdown("Eerste regel.  \nTweede regel.")).toBe(
			true,
		);
		for (const markdown of [
			"Eerste regel.\\\nTweede regel.",
			"Eerste regel.   \nTweede regel.",
			"Eerste regel.  \r\nTweede regel.",
		]) {
			expect(isSupportedEditorMarkdown(markdown)).toBe(false);
		}
	});

	it("rejects excessive nesting without overflowing the stack", () => {
		const markdown = `${"> ".repeat(5_000)}Tekst`;

		expect(isSupportedEditorMarkdown(markdown)).toBe(false);
	});

	it("server-validates the complete Markdown subset and safe inline links", () => {
		const supported = `Tekst met **vet**, *cursief* en [bron](https://example.org).\n\n## Kop\n\n### Subkop\n\n- item\n\n1. item\n\n> citaat\n`;
		expect(isSupportedEditorMarkdown(supported)).toBe(true);
		for (const markdown of [
			"[onveilig](javascript:alert(1))",
			"![beeld](https://example.org/image.jpg)",
			"`code`",
			"<b>html</b>",
			"[bron][ref]\n\n[ref]: https://example.org",
			"---",
		]) {
			expect(isSupportedEditorMarkdown(markdown)).toBe(false);
		}
	});
});
