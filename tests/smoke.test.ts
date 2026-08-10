import { describe, expect, it } from "vitest";

describe("test setup", () => {
	it("runs TypeScript tests", () => {
		const projectName: string = "Toen.";

		expect(projectName).toBe("Toen.");
	});
});
