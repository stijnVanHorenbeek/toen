import { describe, expect, it } from "vitest";
import { getBeatKeyboardAction } from "../src/lib/beats/keyboard";

describe("beat keyboard controls", () => {
	it("maps unclaimed navigation keys without accepting key repeat", () => {
		expect(
			getBeatKeyboardAction({
				key: "ArrowRight",
				repeat: false,
				interactiveTarget: false,
			}),
		).toEqual({ type: "advance" });
		expect(
			getBeatKeyboardAction({
				key: " ",
				repeat: false,
				interactiveTarget: false,
			}),
		).toEqual({ type: "advance" });
		expect(
			getBeatKeyboardAction({
				key: "ArrowLeft",
				repeat: false,
				interactiveTarget: false,
			}),
		).toEqual({ type: "back" });
		expect(
			getBeatKeyboardAction({
				key: "ArrowRight",
				repeat: true,
				interactiveTarget: false,
			}),
		).toBeNull();
		expect(
			getBeatKeyboardAction({
				key: "ArrowRight",
				repeat: false,
				interactiveTarget: true,
			}),
		).toBeNull();
	});

	it("maps Escape to a stop request even when a control has focus", () => {
		expect(
			getBeatKeyboardAction({
				key: "Escape",
				repeat: false,
				interactiveTarget: true,
			}),
		).toEqual({ type: "stop" });
	});

	it("finishes instead of getting stuck when advancing from the lesson bridge", () => {
		expect(
			getBeatKeyboardAction({
				key: "ArrowRight",
				repeat: false,
				interactiveTarget: false,
				canFinish: true,
			}),
		).toEqual({ type: "finish" });
		expect(
			getBeatKeyboardAction({
				key: " ",
				repeat: false,
				interactiveTarget: false,
				canFinish: true,
			}),
		).toEqual({ type: "finish" });
	});
});
