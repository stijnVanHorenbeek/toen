import type { BeatRuntimeAction } from "./runtime";

type BeatKeyboardInput = {
	key: string;
	repeat: boolean;
	interactiveTarget: boolean;
};

export function getBeatKeyboardAction({
	key,
	repeat,
	interactiveTarget,
}: BeatKeyboardInput): BeatRuntimeAction | null {
	if (repeat || interactiveTarget) return null;
	if (key === "ArrowLeft") return { type: "back" };
	if (key === "ArrowRight" || key === " ") return { type: "advance" };
	return null;
}
