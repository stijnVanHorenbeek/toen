"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { BeatClassroomScreen } from "@/app/_components/classroom/classroom-screens";
import type {
	BeatPlayerEvent,
	BeatPlayerVariant,
} from "@/app/_components/classroom/types";
import { getBeatKeyboardAction } from "@/lib/beats/keyboard";
import { createBeatRuntimeState, reduceBeatRuntime } from "@/lib/beats/runtime";
import { messages } from "@/lib/i18n/messages.nl-BE";

export { BeatClassroomScreen } from "@/app/_components/classroom/classroom-screens";
export { BeatStagePanel } from "@/app/_components/classroom/stage-components";

type BeatPlayerProps = {
	event: BeatPlayerEvent;
	onEscape?: () => void;
	variant?: BeatPlayerVariant;
};

export function BeatPlayer({
	event,
	onEscape,
	variant = "page",
}: BeatPlayerProps) {
	const [state, dispatch] = useReducer(
		reduceBeatRuntime,
		undefined,
		createBeatRuntimeState,
	);
	const activeStageIndex =
		state.status === "running" ? state.currentStageIndex : null;
	const canFinish =
		state.status === "running" &&
		state.routeStages[state.currentStageIndex]?.phase === "lesson-bridge";
	const requestStop = useCallback(() => {
		if (!window.confirm(messages.beat.stopConfirm)) return;
		if (onEscape) {
			onEscape();
			return;
		}
		window.location.assign("/");
	}, [onEscape]);
	const focusKey =
		activeStageIndex === null ? state.status : `running:${activeStageIndex}`;
	const previousFocusKey = useRef(focusKey);

	useEffect(() => {
		if (previousFocusKey.current === focusKey) return;
		previousFocusKey.current = focusKey;
		const selector =
			activeStageIndex !== null
				? "[data-classroom-stage-region]"
				: state.status === "finished"
					? "[data-beat-completed]"
					: "[data-beat-preparation]";
		document
			.querySelector<HTMLElement>(selector)
			?.focus({ preventScroll: true });
	}, [focusKey, state.status, activeStageIndex]);

	useEffect(() => {
		if (state.status !== "running") return;
		function handleKeyDown(event: KeyboardEvent) {
			const target = event.target instanceof Element ? event.target : null;
			const action = getBeatKeyboardAction({
				key: event.key,
				repeat: event.repeat,
				interactiveTarget: Boolean(
					target?.closest(
						"button, a, input, select, textarea, [contenteditable=true]",
					),
				),
				canFinish,
			});
			if (!action) return;
			event.preventDefault();
			if (action.type === "stop") {
				requestStop();
				return;
			}
			dispatch(action);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [state.status, canFinish, requestStop]);

	return (
		<BeatClassroomScreen
			event={event}
			state={state}
			dispatch={dispatch}
			onStop={requestStop}
			variant={variant}
		/>
	);
}
