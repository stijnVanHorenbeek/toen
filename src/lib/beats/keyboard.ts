import type { BeatRuntimeAction } from "./runtime";

type BeatGestureInput = {
	deltaX: number;
	deltaY: number;
	canGoBack: boolean;
	canFinish?: boolean;
};

type BeatKeyboardInput = {
	key: string;
	repeat: boolean;
	interactiveTarget: boolean;
	canFinish?: boolean;
};

export function getBeatGestureAction({
	deltaX,
	deltaY,
	canGoBack,
	canFinish = false,
}: BeatGestureInput): BeatRuntimeAction | null {
	if (Math.abs(deltaY) < 40 || Math.abs(deltaY) <= Math.abs(deltaX))
		return null;
	if (deltaY < 0) return canGoBack ? { type: "back" } : null;
	return { type: canFinish ? "finish" : "advance" };
}

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
