import { describe, expect, it } from "vitest";
import {
	createBeatRuntimeStages,
	createBeatRuntimeState,
	reduceBeatRuntime,
} from "../src/lib/beats/runtime";
import { interactiveBeatSchema } from "../src/lib/content/event";
import { voteRevoteBeat } from "./fixtures/interactive-beat";

const routeStages = [
	{ id: "opening", phase: "opening", optional: false },
	{ id: "commitment", phase: "commitment", optional: false },
	{ id: "evidence", phase: "evidence", optional: true },
	{ id: "lesson-bridge", phase: "lesson-bridge", optional: false },
] as const;

describe("beat runtime", () => {
	it("starts in preparation with the eight-minute route selected", () => {
		expect(createBeatRuntimeState()).toEqual({
			status: "preparation",
			durationMinutes: 8,
			currentStageIndex: null,
			skippedStageIds: [],
		});
	});

	it("selects a duration while preparing", () => {
		expect(
			reduceBeatRuntime(createBeatRuntimeState(), {
				type: "select-duration",
				durationMinutes: 5,
			}),
		).toMatchObject({ status: "preparation", durationMinutes: 5 });
	});

	it("derives the selected route from validated beat stages", () => {
		const beat = interactiveBeatSchema.parse(voteRevoteBeat);

		expect(createBeatRuntimeStages(beat, 5)).toEqual(
			beat.routes[0].stageIds.map((id) => {
				const stage = beat.stages.find((candidate) => candidate.id === id);
				return {
					id,
					phase: stage?.phase,
					optional: stage
						? "optional" in stage && stage.optional === true
						: false,
				};
			}),
		);
	});

	it("starts the selected route at its opening stage", () => {
		const state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});

		expect(state).toMatchObject({
			status: "running",
			currentStageIndex: 0,
			routeStages,
		});
	});

	it("advances exactly one stage", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});

		expect(
			reduceBeatRuntime(started, { type: "advance" }).currentStageIndex,
		).toBe(1);
	});

	it("returns to the previous stage", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		const advanced = reduceBeatRuntime(started, { type: "advance" });

		expect(
			reduceBeatRuntime(advanced, { type: "back" }).currentStageIndex,
		).toBe(0);
	});

	it("skips and records an optional stage", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		const atOptionalStage = reduceBeatRuntime(
			reduceBeatRuntime(started, { type: "advance" }),
			{ type: "advance" },
		);
		const skipped = reduceBeatRuntime(atOptionalStage, { type: "skip" });

		expect(skipped).toMatchObject({
			currentStageIndex: 3,
			skippedStageIds: ["evidence"],
		});
	});

	it("does not reopen a skipped stage when going back", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		const atOptionalStage = reduceBeatRuntime(
			reduceBeatRuntime(started, { type: "advance" }),
			{ type: "advance" },
		);
		const skipped = reduceBeatRuntime(atOptionalStage, { type: "skip" });

		expect(reduceBeatRuntime(skipped, { type: "back" }).currentStageIndex).toBe(
			1,
		);
	});

	it("does not reopen a skipped stage when advancing again", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		const atOptionalStage = reduceBeatRuntime(
			reduceBeatRuntime(started, { type: "advance" }),
			{ type: "advance" },
		);
		const skipped = reduceBeatRuntime(atOptionalStage, { type: "skip" });
		const previous = reduceBeatRuntime(skipped, { type: "back" });

		expect(
			reduceBeatRuntime(previous, { type: "advance" }).currentStageIndex,
		).toBe(3);
	});

	it("resets progress but preserves the selected duration", () => {
		const selected = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "select-duration",
			durationMinutes: 5,
		});
		const started = reduceBeatRuntime(selected, { type: "start", routeStages });

		expect(reduceBeatRuntime(started, { type: "reset" })).toEqual({
			status: "preparation",
			durationMinutes: 5,
			currentStageIndex: null,
			skippedStageIds: [],
		});
	});

	it("finishes at the lesson bridge checkpoint", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		const atLessonBridge = [1, 2, 3].reduce(
			(state) => reduceBeatRuntime(state, { type: "advance" }),
			started,
		);

		expect(reduceBeatRuntime(atLessonBridge, { type: "finish" }).status).toBe(
			"finished",
		);
	});

	it("ignores unsafe or out-of-range transitions", () => {
		const started = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		expect(reduceBeatRuntime(started, { type: "skip" })).toBe(started);
		expect(reduceBeatRuntime(started, { type: "finish" })).toBe(started);
		expect(reduceBeatRuntime(started, { type: "back" }).currentStageIndex).toBe(
			0,
		);

		const atLessonBridge = [1, 2, 3].reduce(
			(state) => reduceBeatRuntime(state, { type: "advance" }),
			started,
		);
		expect(
			reduceBeatRuntime(atLessonBridge, { type: "advance" }).currentStageIndex,
		).toBe(3);
		const finished = reduceBeatRuntime(atLessonBridge, { type: "finish" });
		expect(reduceBeatRuntime(finished, { type: "advance" })).toBe(finished);
	});
});
