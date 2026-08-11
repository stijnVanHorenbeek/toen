import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	BeatClassroomScreen,
	BeatPlayer,
	BeatStagePanel,
} from "../src/app/_components/beat-player";
import {
	createBeatRuntimeStages,
	createBeatRuntimeState,
	reduceBeatRuntime,
} from "../src/lib/beats/runtime";
import { interactiveBeatSchema } from "../src/lib/content/event";
import { beatSources, voteRevoteBeat } from "./fixtures/interactive-beat";

const beat = interactiveBeatSchema.parse(voteRevoteBeat);

describe("BeatPlayer", () => {
	it("renders the classroom preparation screen", () => {
		const markup = renderToStaticMarkup(
			<BeatPlayer
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
			/>,
		);

		for (const text of [
			"Kies de duur",
			"Apollo 11 landt op de maan",
			"Hoeveel tijd heb je?",
			"5 minuten",
			"8 minuten",
			"12 minuten",
			"Start",
			"Na herladen begin je opnieuw",
			"Lees het verhaal",
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="8"/);
	});

	it("keeps internal beat and authoring-role language off the projector", () => {
		const preparation = renderToStaticMarkup(
			<BeatPlayer
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
			/>,
		);
		const opening = beat.stages.find((stage) => stage.phase === "opening");
		if (!opening) throw new Error("Missing opening fixture");
		const projectedStage = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={opening}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		expect(preparation).not.toMatch(/klasbeat/i);
		expect(projectedStage).not.toContain("Leerkracht:");
		expect(projectedStage).not.toContain("Leerlingen:");
	});

	it("renders current progress and controls while running", () => {
		const state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages: createBeatRuntimeStages(beat, 8),
		});
		const markup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
				state={state}
				dispatch={() => undefined}
			/>,
		);

		for (const text of [
			"Apollo 11 landt op de maan",
			beat.question,
			"Stap 1 van 10",
			"Terug",
			"Volgende",
			"Opnieuw",
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain("Overslaan");
		expect(markup).toContain('data-classroom-stage-region="true"');
		expect(markup).toContain('tabindex="-1"');
		expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Terug<\/button>/);
	});

	it("shows Skip only on optional states and Finish only at closure", () => {
		const routeStages = createBeatRuntimeStages(beat, 8);
		let state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		for (let index = 0; index < 4; index += 1) {
			state = reduceBeatRuntime(state, { type: "advance" });
		}
		const optionalMarkup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
				state={state}
				dispatch={() => undefined}
			/>,
		);
		expect(optionalMarkup).toContain("Overslaan");
		expect(optionalMarkup).not.toContain(">Klaar</button>");

		for (let index = 5; index < routeStages.length; index += 1) {
			state = reduceBeatRuntime(state, { type: "advance" });
		}
		const closureMarkup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
				state={state}
				dispatch={() => undefined}
			/>,
		);
		expect(closureMarkup).toContain(">Klaar</button>");
		expect(closureMarkup).not.toContain(">Volgende</button>");
	});

	it("labels forward navigation from the next unskipped stage", () => {
		const routeStages = createBeatRuntimeStages(beat, 8);
		let state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		for (let index = 0; index < 4; index += 1) {
			state = reduceBeatRuntime(state, { type: "advance" });
		}
		state = reduceBeatRuntime(state, { type: "skip" });
		state = reduceBeatRuntime(state, { type: "back" });
		const markup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
				state={state}
				dispatch={() => undefined}
			/>,
		);

		expect(markup).toContain(">Volgende</button>");
		expect(markup).not.toContain("Toon meer");
	});

	it("renders a bounded completion screen with clean exits", () => {
		const routeStages = createBeatRuntimeStages(beat, 5);
		let state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		for (let index = 1; index < routeStages.length; index += 1) {
			state = reduceBeatRuntime(state, { type: "advance" });
		}
		state = reduceBeatRuntime(state, { type: "finish" });
		const markup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={{
					slug: "apollo-11-1969",
					title: "Apollo 11 landt op de maan",
					sources: beatSources.map((source) => ({ ...source })),
					beat,
				}}
				state={state}
				dispatch={() => undefined}
			/>,
		);

		for (const text of [
			"Klaar",
			"Lees het verhaal",
			"Terug naar start",
			"Nog een keer",
		]) {
			expect(markup).toContain(text);
		}
	});

	it("renders the opening stimulus without revealing an answer", () => {
		const opening = beat.stages.find((stage) => stage.phase === "opening");
		if (!opening) throw new Error("Missing opening fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={opening}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		for (const text of [
			beat.question,
			opening.stimulus,
			...beat.choices.map(({ label }) => label),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(opening.teacherPrompt);
		expect(markup).not.toContain("Wat gebeurde er?");
	});

	it("renders the private commitment prompt and choices", () => {
		const commitment = beat.stages.find(
			(stage) => stage.phase === "commitment",
		);
		if (!commitment) throw new Error("Missing commitment fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={commitment}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		for (const text of [
			commitment.prompt,
			...beat.choices.map(({ label }) => label),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(commitment.teacherPrompt);
	});

	it("renders peer discussion with its sentence starter", () => {
		const discussion = beat.stages.find(
			(stage) => stage.phase === "discussion",
		);
		if (!discussion?.sentenceStarter) {
			throw new Error("Missing discussion fixture");
		}
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={discussion}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		for (const text of [discussion.prompt, discussion.sentenceStarter]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(discussion.teacherPrompt);
	});

	it("renders the revision prompt with the same choices", () => {
		const revision = beat.stages.find((stage) => stage.phase === "revision");
		if (!revision) throw new Error("Missing revision fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={revision}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		for (const text of [
			revision.prompt,
			...beat.choices.map(({ label }) => label),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(revision.teacherPrompt);
	});

	it("renders the evidence-linked reasoning prompt", () => {
		const reasoning = beat.stages.find((stage) => stage.phase === "reasoning");
		if (!reasoning) throw new Error("Missing reasoning fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={reasoning}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		expect(markup).toContain(reasoning.prompt);
		expect(markup).not.toContain(reasoning.teacherPrompt);
		expect(markup).not.toContain("klassentotaal");
	});

	it("renders resolution feedback and source identities", () => {
		const resolution = beat.stages.find(
			(stage) => stage.phase === "resolution",
		);
		if (!resolution) throw new Error("Missing resolution fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={resolution}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		for (const text of [
			resolution.title,
			resolution.feedback,
			resolution.misconception,
			...beatSources.map(({ title }) => title),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(resolution.teacherPrompt);
	});

	it("renders the final lesson bridge", () => {
		const lessonBridge = beat.stages.find(
			(stage) => stage.phase === "lesson-bridge",
		);
		if (!lessonBridge) throw new Error("Missing lesson bridge fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={lessonBridge}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		expect(markup).toContain(lessonBridge.bridge);
		expect(markup).not.toContain(lessonBridge.teacherPrompt);
	});

	it("renders evidence with compact source identity", () => {
		const evidence = beat.stages.find((stage) => stage.phase === "evidence");
		if (!evidence) throw new Error("Missing evidence fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={evidence}
				sources={beatSources.map((source) => ({ ...source }))}
			/>,
		);

		for (const text of [
			evidence.title,
			evidence.evidence,
			beatSources[0].title,
			beatSources[0].publisher,
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(evidence.teacherPrompt);
		expect(markup).not.toContain("Bron verwijderen");
	});
});
