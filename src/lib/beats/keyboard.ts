import type { BeatRuntimeAction } from "./runtime";

type BeatKeyboardInput = {
	key: string;
	repeat: boolean;
	interactiveTarget: boolean;
	canFinish?: boolean;
};

export function getBeatKeyboardAction({
	key,
	repeat,
	interactiveTarget,
	canFinish = false,
}: BeatKeyboardInput): BeatRuntimeAction | null {
	if (repeat) return null;
	if (key === "Escape") return { type: "stop" };
	if (interactiveTarget) return null;
	if (key === "ArrowLeft") return { type: "back" };
	if (key === "ArrowRight" || key === " ") {
		return { type: canFinish ? "finish" : "advance" };
	}
	return null;
}
