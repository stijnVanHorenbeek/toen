import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	getEventVisual,
	historicalVisuals,
} from "../src/lib/content/event-media";
import { historicalVisualSourcePaths } from "../src/lib/content/static-media-sources";

describe("historical event media", () => {
	it("keeps curated media local, attributed, and content-addressed", () => {
		for (const [id, visual] of Object.entries(historicalVisuals)) {
			const sourcePath =
				historicalVisualSourcePaths[
					id as keyof typeof historicalVisualSourcePaths
				];
			expect(sourcePath).toMatch(/^media\/sources\/[a-z0-9-]+\.webp$/);
			expect(visual.src).toBe(`/media/assets/${visual.sha256}.webp`);
			expect(existsSync(path.join(process.cwd(), sourcePath))).toBe(true);
			expect(visual.alt.trim()).not.toBe("");
			expect(visual.caption.trim()).not.toBe("");
			expect(visual.credit.trim()).not.toBe("");
			expect(visual.license.trim()).not.toBe("");
			expect(visual.licenseRationale.trim()).not.toBe("");
			expect(visual.derivative.trim()).not.toBe("");
			expect(visual.originalUrl).toMatch(
				/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//,
			);
			expect(visual.sourceUrl).toMatch(
				/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
			);
			const asset = readFileSync(path.join(process.cwd(), sourcePath));
			expect(createHash("sha256").update(asset).digest("hex")).toBe(
				visual.sha256,
			);
		}
	});

	it("maps only curated event slugs to visuals", () => {
		expect(getEventVisual("apollo-11-1969")).toMatchObject({
			credit: "Neil A. Armstrong / NASA",
		});
		expect(getEventVisual("unpublished-event")).toBeNull();
	});
});
