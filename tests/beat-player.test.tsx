import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	BeatClassroomScreen,
	BeatStagePanel,
} from "../src/app/_components/beat-player";
import {
	createBeatRuntimeStages,
	createBeatRuntimeState,
	reduceBeatRuntime,
} from "../src/lib/beats/runtime";
import { interactiveBeatSchema } from "../src/lib/content/event";
import {
	beatSources,
	contextDecisionBeat,
	sourceDuelBeat,
	voteRevoteBeat,
} from "./fixtures/interactive-beat";

const beat = interactiveBeatSchema.parse(voteRevoteBeat);
const sources = beatSources.map((source) => ({ ...source }));
const visual = {
	src: "/media/assets/2d514da09e22846759e1552189646ee456a973fa641399599875dc10bae7c5cb.webp",
	width: 1_800,
	height: 1_800,
	alt: "Buzz Aldrin staat op het maanoppervlak.",
	caption: "Buzz Aldrin tijdens Apollo 11, 20 juli 1969.",
	credit: "Neil A. Armstrong / NASA",
	license: "Publiek domein",
	licenseRationale: "Officiële NASA-foto.",
	sourceUrl: "https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11.jpg",
	originalUrl:
		"https://upload.wikimedia.org/wikipedia/commons/9/9c/Aldrin_Apollo_11.jpg",
	derivative: "Testbestand.",
	sha256: "test",
	focalPoint: "50% 42%",
};

describe("BeatStagePanel", () => {
	it("shows Skip only on optional stages and Finish only at closure", () => {
		const event = { slug: "test-event", title: "Test event", sources, beat };
		const routeStages = createBeatRuntimeStages(beat, 8);
		let state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		for (let index = 0; index < 4; index += 1) {
			state = reduceBeatRuntime(state, { type: "advance" });
		}
		if (state.status !== "running") throw new Error("Expected running state");
		const optionalStageId = state.routeStages[state.currentStageIndex].id;
		const optionalStage = beat.stages.find(({ id }) => id === optionalStageId);
		if (!optionalStage) throw new Error("Missing optional stage fixture");
		const optionalMarkup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={event}
				state={state}
				dispatch={() => undefined}
			/>,
		);
		expect(optionalMarkup).toContain(">Overslaan</button>");
		expect(optionalMarkup).toContain('aria-label="Presentatie sluiten"');
		expect(optionalMarkup).not.toContain(">Stoppen</button>");
		expect(optionalMarkup).toContain(optionalStage.teacherPrompt);
		expect(optionalMarkup).not.toContain(">Klaar</button>");

		for (let index = 5; index < routeStages.length; index += 1) {
			state = reduceBeatRuntime(state, { type: "advance" });
		}
		const closureMarkup = renderToStaticMarkup(
			<BeatClassroomScreen
				event={event}
				state={state}
				dispatch={() => undefined}
			/>,
		);
		expect(closureMarkup).toContain(">Klaar</button>");
		expect(closureMarkup).toContain('aria-label="Presentatie sluiten"');
		expect(closureMarkup).not.toContain(">Stoppen</button>");
		expect(closureMarkup).not.toContain(">Overslaan</button>");
		expect(closureMarkup).not.toContain(">Volgende</button>");
	});

	it("keeps public and admin preview stage semantics and controls in parity", () => {
		const event = { slug: "test-event", title: "Test event", sources, beat };
		const routeStages = createBeatRuntimeStages(beat, 5);
		const state = reduceBeatRuntime(createBeatRuntimeState(), {
			type: "start",
			routeStages,
		});
		if (state.status !== "running") throw new Error("Expected running state");
		const renderVariant = (variant: "page" | "preview") =>
			renderToStaticMarkup(
				<BeatClassroomScreen
					event={event}
					state={state}
					dispatch={() => undefined}
					variant={variant}
				/>,
			);
		const normalizeVariant = (markup: string) =>
			markup
				.replace(/data-classroom-player-variant="(?:page|preview)"/g, "")
				.replace(/class="([^"]*)"/g, (_match, classes: string) =>
					classes
						.split(" ")
						.filter(
							(className) => className !== "h-dvh" && className !== "h-full",
						)
						.join(" "),
				);

		const pageMarkup = renderVariant("page");
		const previewMarkup = renderVariant("preview");
		expect(pageMarkup).toContain('data-classroom-player-variant="page"');
		expect(previewMarkup).toContain('data-classroom-player-variant="preview"');
		expect(normalizeVariant(previewMarkup)).toBe(normalizeVariant(pageMarkup));
	});

	it("uses a dominant attributed visual when curated media is available", () => {
		const opening = beat.stages.find((stage) => stage.phase === "opening");
		if (!opening) throw new Error("Missing opening fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={beat}
				stage={opening}
				sources={sources}
				visual={visual}
			/>,
		);

		expect(markup).toContain(`src="${visual.src}"`);
		expect(markup).toContain(`alt="${visual.alt}"`);
		expect(markup).toContain(visual.credit);
		expect(markup).toContain(visual.license);
		expect(markup).toContain(`href="${visual.sourceUrl}"`);
		expect(markup).not.toContain(visual.caption);
	});

	it("renders the opening problem without presenter instructions", () => {
		const opening = beat.stages.find((stage) => stage.phase === "opening");
		if (!opening) throw new Error("Missing opening fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={opening} sources={sources} />,
		);

		for (const text of [
			beat.question,
			opening.stimulus,
			...beat.choices.map(({ label }) => label),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(opening.teacherPrompt);
	});

	it("renders both attributed source cards in a source duel opening", () => {
		const sourceDuel = interactiveBeatSchema.parse(sourceDuelBeat);
		const opening = sourceDuel.stages.find(
			(stage) => stage.phase === "opening",
		);
		if (!opening || sourceDuel.mechanic !== "source-duel") {
			throw new Error("Missing source duel opening fixture");
		}
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={sourceDuel} stage={opening} sources={sources} />,
		);

		for (const card of sourceDuel.sourceCards) {
			const source = sources.find(({ url }) => url === card.sourceUrl);
			expect(markup).toContain(card.label);
			expect(markup).toContain(card.excerpt);
			expect(markup).toContain(source?.title);
			expect(markup).toContain(source?.publisher);
		}
		expect(markup).not.toContain(opening.teacherPrompt);
	});

	it("renders the bounded perspective in a context decision opening", () => {
		const contextDecision = interactiveBeatSchema.parse(contextDecisionBeat);
		const opening = contextDecision.stages.find(
			(stage) => stage.phase === "opening",
		);
		if (!opening || contextDecision.mechanic !== "context-decision") {
			throw new Error("Missing context decision opening fixture");
		}
		const markup = renderToStaticMarkup(
			<BeatStagePanel
				beat={contextDecision}
				stage={opening}
				sources={sources}
			/>,
		);

		expect(markup).toContain(contextDecision.perspective);
		expect(markup).not.toContain(opening.teacherPrompt);
	});

	it("renders private commitment choices without presenter instructions", () => {
		const commitment = beat.stages.find(
			(stage) => stage.phase === "commitment",
		);
		if (!commitment) throw new Error("Missing commitment fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={commitment} sources={sources} />,
		);

		for (const text of [
			commitment.prompt,
			...beat.choices.map(({ label }) => label),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(commitment.teacherPrompt);
	});

	it("renders peer discussion without presenter scaffolding", () => {
		const discussion = beat.stages.find(
			(stage) => stage.phase === "discussion",
		);
		if (!discussion?.sentenceStarter) {
			throw new Error("Missing discussion fixture");
		}
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={discussion} sources={sources} />,
		);

		expect(markup).toContain(discussion.prompt);
		expect(markup).not.toContain(discussion.sentenceStarter);
		expect(markup).not.toContain(discussion.teacherPrompt);
	});

	it("renders revision choices without presenter instructions", () => {
		const revision = beat.stages.find((stage) => stage.phase === "revision");
		if (!revision) throw new Error("Missing revision fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={revision} sources={sources} />,
		);

		for (const text of [
			revision.prompt,
			...beat.choices.map(({ label }) => label),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(revision.teacherPrompt);
	});

	it("renders evidence-linked reasoning without presenter instructions", () => {
		const reasoning = beat.stages.find((stage) => stage.phase === "reasoning");
		if (!reasoning) throw new Error("Missing reasoning fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={reasoning} sources={sources} />,
		);

		expect(markup).toContain(reasoning.prompt);
		expect(markup).not.toContain(reasoning.teacherPrompt);
	});

	it("renders resolution feedback and source identities", () => {
		const resolution = beat.stages.find(
			(stage) => stage.phase === "resolution",
		);
		if (!resolution) throw new Error("Missing resolution fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={resolution} sources={sources} />,
		);

		for (const text of [
			resolution.title,
			resolution.feedback,
			resolution.misconception,
			...sources.map(({ title }) => title),
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(resolution.teacherPrompt);
	});

	it("renders the final lesson bridge without presenter instructions", () => {
		const lessonBridge = beat.stages.find(
			(stage) => stage.phase === "lesson-bridge",
		);
		if (!lessonBridge) throw new Error("Missing lesson bridge fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={lessonBridge} sources={sources} />,
		);

		expect(markup).toContain(lessonBridge.bridge);
		expect(markup).not.toContain(lessonBridge.teacherPrompt);
	});

	it("shows version 2 response setup and vocational lesson connection", () => {
		const version2 = interactiveBeatSchema.parse({
			...voteRevoteBeat,
			version: 2,
			responseMethod: "response-cards",
			vocationalConnection: "Koppel dit aan veilige werkprocedures.",
		});
		const event = {
			slug: "test-event",
			title: "Test event",
			sources,
			beat: version2,
		};
		const preparation = renderToStaticMarkup(
			<BeatClassroomScreen
				event={event}
				state={createBeatRuntimeState()}
				dispatch={() => undefined}
			/>,
		);
		const lessonBridge = version2.stages.find(
			(stage) => stage.phase === "lesson-bridge",
		);
		if (!lessonBridge) throw new Error("Missing lesson bridge fixture");
		const bridge = renderToStaticMarkup(
			<BeatStagePanel beat={version2} stage={lessonBridge} sources={sources} />,
		);

		expect(preparation).toContain("Antwoordkaarten");
		expect(preparation).toContain('aria-label="5 minuten"');
		expect(preparation).toContain(">5 min</span>");
		expect(preparation).toContain("<fieldset");
		expect(preparation).toContain("<legend");
		expect(bridge).toContain("Koppel dit aan veilige werkprocedures.");
	});

	it("renders evidence with compact source identity", () => {
		const evidence = beat.stages.find((stage) => stage.phase === "evidence");
		if (!evidence) throw new Error("Missing evidence fixture");
		const markup = renderToStaticMarkup(
			<BeatStagePanel beat={beat} stage={evidence} sources={sources} />,
		);

		for (const text of [
			evidence.title,
			evidence.evidence,
			sources[0].title,
			sources[0].publisher,
		]) {
			expect(markup).toContain(text);
		}
		expect(markup).not.toContain(evidence.teacherPrompt);
	});
});
