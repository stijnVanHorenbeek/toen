import type { InteractiveBeat } from "../content/event";

export type BeatDurationMinutes = 5 | 8 | 12;
type BeatPhase = InteractiveBeat["stages"][number]["phase"];

export type BeatRuntimeStage = {
	id: string;
	phase: BeatPhase;
	optional: boolean;
};

type BeatRuntimePreparationState = {
	status: "preparation";
	durationMinutes: BeatDurationMinutes;
	currentStageIndex: null;
	skippedStageIds: readonly string[];
};

type BeatRuntimeActiveState = {
	status: "running" | "finished";
	durationMinutes: BeatDurationMinutes;
	currentStageIndex: number;
	skippedStageIds: readonly string[];
	routeStages: readonly BeatRuntimeStage[];
};

export type BeatRuntimeState =
	| BeatRuntimePreparationState
	| BeatRuntimeActiveState;

export type BeatRuntimeAction =
	| {
			type: "select-duration";
			durationMinutes: BeatDurationMinutes;
	  }
	| { type: "start"; routeStages: readonly BeatRuntimeStage[] }
	| { type: "advance" }
	| { type: "back" }
	| { type: "skip" }
	| { type: "reset" }
	| { type: "finish" };

export function createBeatRuntimeStages(
	beat: InteractiveBeat,
	durationMinutes: BeatDurationMinutes,
): BeatRuntimeStage[] {
	const route = beat.routes.find(
		(candidate) => candidate.durationMinutes === durationMinutes,
	);
	if (!route) return [];
	const stagesById = new Map(beat.stages.map((stage) => [stage.id, stage]));
	return route.stageIds.map((id) => {
		const stage = stagesById.get(id);
		if (!stage) throw new Error(`Unknown beat stage: ${id}`);
		return {
			id,
			phase: stage.phase,
			optional: "optional" in stage && stage.optional === true,
		};
	});
}

export function createBeatRuntimeState(): BeatRuntimeState {
	return {
		status: "preparation",
		durationMinutes: 8,
		currentStageIndex: null,
		skippedStageIds: [],
	};
}

export function reduceBeatRuntime(
	state: BeatRuntimeState,
	action: BeatRuntimeAction,
): BeatRuntimeState {
	if (action.type === "reset") {
		return {
			status: "preparation",
			durationMinutes: state.durationMinutes,
			currentStageIndex: null,
			skippedStageIds: [],
		};
	}
	if (state.status === "preparation") {
		if (action.type === "select-duration") {
			return { ...state, durationMinutes: action.durationMinutes };
		}
		if (action.type === "start") {
			return {
				...state,
				status: "running",
				currentStageIndex: 0,
				routeStages: action.routeStages,
			};
		}
		return state;
	}
	if (state.status !== "running") return state;
	if (
		action.type === "finish" &&
		state.routeStages[state.currentStageIndex].phase === "lesson-bridge"
	) {
		return { ...state, status: "finished" };
	}
	if (action.type === "advance") {
		let nextIndex = Math.min(
			state.currentStageIndex + 1,
			state.routeStages.length - 1,
		);
		while (
			nextIndex < state.routeStages.length - 1 &&
			state.skippedStageIds.includes(state.routeStages[nextIndex].id)
		) {
			nextIndex += 1;
		}
		return { ...state, currentStageIndex: nextIndex };
	}
	if (action.type === "back") {
		let previousIndex = Math.max(state.currentStageIndex - 1, 0);
		while (
			previousIndex > 0 &&
			state.skippedStageIds.includes(state.routeStages[previousIndex].id)
		) {
			previousIndex -= 1;
		}
		return { ...state, currentStageIndex: previousIndex };
	}
	if (action.type === "skip") {
		const stage = state.routeStages[state.currentStageIndex];
		if (!stage.optional) return state;
		return {
			...state,
			currentStageIndex: Math.min(
				state.currentStageIndex + 1,
				state.routeStages.length - 1,
			),
			skippedStageIds: [...state.skippedStageIds, stage.id],
		};
	}
	return state;
}
