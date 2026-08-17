import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);

const classroomConsoleErrors = new WeakMap<object, string[]>();

Given("I open the Apollo 11 classroom beat", async ({ page }) => {
	const errors: string[] = [];
	classroomConsoleErrors.set(page, errors);
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	await page.goto("/events/apollo-11-1969/play");
});

Given(
	"I open the Belgian independence classroom activity",
	async ({ page }) => {
		await page.goto("/events/belgium-independence-1830/play");
	},
);

Given("I open the D-Day classroom activity", async ({ page }) => {
	await page.goto(
		"/events/d-day-de-geallieerde-landing-in-normandie-1944/play",
	);
});

Given("I open classroom activity {string}", async ({ page }, event: string) => {
	const paths: Record<string, string> = {
		Apollo: "/events/apollo-11-1969/play",
		Belgium: "/events/belgium-independence-1830/play",
		Constantinople: "/events/val-van-constantinopel-1453/play",
		"D-Day": "/events/d-day-de-geallieerde-landing-in-normandie-1944/play",
	};
	const path = paths[event];
	if (!path) throw new Error(`Unknown classroom activity: ${event}`);
	await page.goto(path);
});

Given("reduced motion is enabled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
});

Given(
	"the classroom viewport is {int} by {int}",
	async ({ page }, width: number, height: number) => {
		await page.setViewportSize({ width, height });
	},
);

Then("the 8 minute beat route is selected", async ({ page }) => {
	await expect(page.getByLabel("8 minuten")).toBeChecked();
});

When("I choose the 5 minute beat route", async ({ page }) => {
	await page.locator('label:has(input[aria-label="5 minuten"])').click();
	await expect(page.getByLabel("5 minuten")).toBeChecked();
});

When("I start the classroom beat", async ({ page }) => {
	await page.getByRole("button", { name: "Start", exact: true }).click();
	await expect(page.locator('[data-beat-phase="opening"]')).toBeVisible({
		timeout: 5_000,
	});
});

When(
	"I use the classroom control {string}",
	async ({ page }, control: string) => {
		await page.getByRole("button", { name: control, exact: true }).click();
	},
);

When(
	"I rapidly activate the classroom control {string} twice",
	async ({ page }, control: string) => {
		await page.getByRole("button", { name: control, exact: true }).dblclick();
	},
);

When("I reset and confirm the classroom beat", async ({ page }) => {
	page.once("dialog", async (dialog) => {
		expect(dialog.type()).toBe("confirm");
		await dialog.accept();
	});
	await page.getByRole("button", { name: "Opnieuw", exact: true }).click();
});

Then("the close control is in the top-right header", async ({ page }) => {
	const header = page.locator(".classroom-runtime > header");
	const close = header.getByRole("button", {
		name: "Presentatie sluiten",
		exact: true,
	});
	await expect(close).toBeVisible();
	const [headerBox, closeBox] = await Promise.all([
		header.boundingBox(),
		close.boundingBox(),
	]);
	if (!headerBox || !closeBox) throw new Error("Missing close control layout");
	expect(closeBox.width).toBe(closeBox.height);
	expect(closeBox.width).toBeGreaterThanOrEqual(48);
	expect(closeBox.x + closeBox.width).toBeGreaterThan(
		headerBox.x + headerBox.width / 2,
	);
});

When("I choose to stop but cancel", async ({ page }) => {
	page.once("dialog", async (dialog) => {
		expect(dialog.type()).toBe("confirm");
		await dialog.dismiss();
	});
	await page
		.getByRole("button", { name: "Presentatie sluiten", exact: true })
		.click();
});

When(
	"I stop the classroom beat with the control and confirm",
	async ({ page }) => {
		page.once("dialog", async (dialog) => {
			expect(dialog.type()).toBe("confirm");
			await dialog.accept();
		});
		await page
			.getByRole("button", { name: "Presentatie sluiten", exact: true })
			.click();
	},
);

Then("I return to the homepage", async ({ page }) => {
	await expect(page).toHaveURL(/\/$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Kies een activiteit" }),
	).toBeVisible();
});

When("I reload the classroom beat", async ({ page }) => {
	await page.reload();
});

When(
	"I advance to classroom phase {string}",
	async ({ page }, phase: string) => {
		const target = page.locator(`[data-beat-phase="${phase}"]`);
		for (let step = 0; step < 16 && !(await target.isVisible()); step += 1) {
			await page
				.getByRole("button", { name: /^(Volgende|Toon meer)$/ })
				.click();
		}
		await expect(target).toBeVisible();
	},
);

When("I press the classroom key {string}", async ({ page }, key: string) => {
	await page.keyboard.press(key);
});

Then("beat phase {string} is visible", async ({ page }, phase: string) => {
	await expect(page.locator(`[data-beat-phase="${phase}"]`)).toBeVisible();
});

Then(
	"the Apollo historical image and attribution are visible",
	async ({ page }) => {
		const visual = page.locator("[data-classroom-visual]");
		await expect(visual.getByRole("img")).toHaveAttribute(
			"src",
			"/media/events/apollo-11-aldrin.webp",
		);
		await expect(visual).toContainText("Neil A. Armstrong / NASA");
		await expect(
			visual.getByRole("link", { name: "Beeldbron" }),
		).toHaveAttribute(
			"href",
			"https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11.jpg",
		);
	},
);

Then(
	"visual-stage labels and attribution remain readable",
	async ({ page }) => {
		const label = page.locator(
			'[data-beat-phase="opening"] [data-stage-eyebrow]',
		);
		const caption = page.locator("[data-classroom-visual] figcaption");
		await expect(label).toBeVisible();
		await expect(caption).toBeVisible();
		const readability = await Promise.all(
			[label, caption].map((element) =>
				element.evaluate((node) => ({
					fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
					clientHeight: node.clientHeight,
					scrollHeight: node.scrollHeight,
				})),
			),
		);
		expect(readability[0].fontSize).toBeGreaterThanOrEqual(12);
		expect(readability[1].fontSize).toBeGreaterThanOrEqual(12);
		for (const item of readability) {
			expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight + 1);
		}
	},
);

Then("visual attribution does not cover stage content", async ({ page }) => {
	const stage = page.locator("[data-stage-visual-layout]");
	const [contentBox, captionBox] = await Promise.all([
		stage.locator("[data-stage-visual-content]").boundingBox(),
		stage.locator("[data-classroom-visual] figcaption").boundingBox(),
	]);
	if (!contentBox || !captionBox)
		throw new Error("Missing visual stage layout");
	const overlaps =
		contentBox.x < captionBox.x + captionBox.width &&
		contentBox.x + contentBox.width > captionBox.x &&
		contentBox.y < captionBox.y + captionBox.height &&
		contentBox.y + contentBox.height > captionBox.y;
	expect(overlaps).toBe(false);
});

Then("the stage transition moves forward", async ({ page }) => {
	await expect(page.locator("[data-classroom-stage-frame]")).toHaveAttribute(
		"data-transition-direction",
		"forward",
	);
});

Then("the stage transition moves back", async ({ page }) => {
	await expect(page.locator("[data-classroom-stage-frame]")).toHaveAttribute(
		"data-transition-direction",
		"back",
	);
});

Then("stage motion is brief and blur-free", async ({ page }) => {
	const motion = await page
		.locator("[data-classroom-stage-frame]")
		.evaluate((element) =>
			element.getAnimations().map((animation) => {
				const effect = animation.effect as KeyframeEffect | null;
				return {
					duration: Number(effect?.getTiming().duration ?? 0),
					usesBlur: effect
						?.getKeyframes()
						.some((keyframe) => String(keyframe.filter ?? "").includes("blur")),
				};
			}),
		);
	expect(motion.length).toBeGreaterThan(0);
	expect(motion.every(({ duration }) => duration > 0 && duration <= 300)).toBe(
		true,
	);
	expect(motion.some(({ usesBlur }) => usesBlur)).toBe(false);
});

Then("classroom transitions are disabled", async ({ page }) => {
	await expect
		.poll(() =>
			page
				.locator("[data-classroom-stage-frame]")
				.evaluate((element) => element.getAnimations().length),
		)
		.toBe(0);
});

Then("two attributed source cards are visible", async ({ page }) => {
	const cards = page.locator("[data-source-card]");
	await expect(cards).toHaveCount(2);
	for (const card of await cards.all()) {
		await expect(card.locator("cite")).toBeVisible();
	}
});

Then("projected source card content remains readable", async ({ page }) => {
	const questionSize = await page
		.locator('[data-beat-mechanic="source-duel"] h2')
		.evaluate((element) =>
			Number.parseFloat(getComputedStyle(element).fontSize),
		);
	for (const content of await page
		.locator("[data-source-card] [data-source-excerpt]")
		.all()) {
		const fontSize = await content.evaluate((element) =>
			Number.parseFloat(getComputedStyle(element).fontSize),
		);
		expect(fontSize).toBeGreaterThanOrEqual(16);
		expect(questionSize).toBeGreaterThan(fontSize);
	}
});

Then("the source duel opening text is fully visible", async ({ page }) => {
	const content = page.locator(
		'[data-beat-mechanic="source-duel"] :is(.classroom-stage-body, [data-source-excerpt], .classroom-source-card-citation, [data-source-citation])',
	);
	await expect(content).toHaveCount(5);
	for (const element of await content.all()) {
		const geometry = await element.evaluate((node) => ({
			clientHeight: node.clientHeight,
			scrollHeight: node.scrollHeight,
			overflowY: getComputedStyle(node).overflowY,
		}));
		expect(geometry.scrollHeight).toBeLessThanOrEqual(
			geometry.clientHeight + 2,
		);
		expect(geometry.overflowY).not.toBe("hidden");
	}
});

Then("source citations remain close to their excerpts", async ({ page }) => {
	const relationships = await page
		.locator("[data-source-card]")
		.evaluateAll((cards) =>
			cards.map((card) => {
				const excerpt = card.querySelector<HTMLElement>(
					"[data-source-excerpt]",
				);
				const citation = card.querySelector<HTMLElement>(
					"[data-source-citation]",
				);
				if (!excerpt || !citation)
					throw new Error("Missing source card content");
				const excerptBox = excerpt.getBoundingClientRect();
				const citationBox = citation.getBoundingClientRect();
				const lineHeight = Number.parseFloat(
					getComputedStyle(excerpt).lineHeight,
				);
				return {
					distance: citationBox.top - excerptBox.bottom,
					allowance: Math.max(lineHeight * 1.5, 24),
				};
			}),
		);
	expect(
		relationships.every(({ distance, allowance }) => distance <= allowance),
	).toBe(true);
});

Then("projected source identity is readable", async ({ page }) => {
	const citations = page.locator("[data-source-citation]");
	await expect(citations).toHaveCount(2);
	for (const citation of await citations.all()) {
		await expect(citation).toBeVisible();
		const geometry = await citation.evaluate((element) => ({
			fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			overflowY: getComputedStyle(element).overflowY,
		}));
		expect(geometry.fontSize).toBeGreaterThanOrEqual(12);
		expect(geometry.scrollHeight).toBeLessThanOrEqual(
			geometry.clientHeight + 1,
		);
		expect(geometry.overflowY).not.toBe("hidden");
	}
});

Then("the source duel uses the available stage height", async ({ page }) => {
	const stage = page.locator('[data-beat-mechanic="source-duel"]');
	const region = page.locator("[data-classroom-stage-region]");
	const [stageBox, regionBox] = await Promise.all([
		stage.boundingBox(),
		region.boundingBox(),
	]);
	if (!stageBox || !regionBox) throw new Error("Missing source duel stage");
	expect(stageBox.y).toBeGreaterThanOrEqual(regionBox.y - 1);
	expect(stageBox.height).toBeGreaterThan(regionBox.height / 2);
	if (stageBox.y + stageBox.height > regionBox.y + regionBox.height + 1) {
		const overflow = await region.evaluate(
			(element) => getComputedStyle(element).overflowY,
		);
		expect(overflow).toBe("auto");
	}
});

Then(
	"classroom progress is step {int} of {int}",
	async ({ page }, step: number, total: number) => {
		await expect(page.locator("[data-classroom-progress]")).toHaveText(
			`Stap ${step} van ${total}`,
		);
	},
);

Then("the context decision perspective is visible", async ({ page }) => {
	await expect(page.locator("[data-beat-perspective]")).toBeVisible();
});

Then(
	"four projected choices have equal height and centered labels",
	async ({ page }) => {
		const cards = page.locator("[data-beat-choice]");
		await expect(cards).toHaveCount(4);
		const geometry = await cards.evaluateAll((elements) =>
			elements.map((element) => {
				const box = element.getBoundingClientRect();
				const range = document.createRange();
				range.selectNodeContents(element);
				const textBox = range.getBoundingClientRect();
				return {
					height: box.height,
					verticalOffset: Math.abs(
						textBox.top + textBox.height / 2 - (box.top + box.height / 2),
					),
				};
			}),
		);
		expect(
			Math.max(...geometry.map(({ height }) => height)),
		).toBeLessThanOrEqual(
			Math.min(...geometry.map(({ height }) => height)) + 1,
		);
		expect(geometry.every(({ verticalOffset }) => verticalOffset <= 2)).toBe(
			true,
		);
	},
);

Then("projected choices stack one per row", async ({ page }) => {
	const cards = page.locator("[data-beat-choice]");
	await expect(cards).toHaveCount(4);
	const geometry = await cards.evaluateAll((elements) =>
		elements.map((element) => {
			const box = element.getBoundingClientRect();
			return { left: box.left, right: box.right, top: box.top };
		}),
	);
	const [first, ...rest] = geometry;
	if (!first) throw new Error("Missing projected choices");
	expect(
		rest.every(
			(card, index) =>
				Math.abs(card.left - first.left) <= 1 &&
				Math.abs(card.right - first.right) <= 1 &&
				card.top > geometry[index].top,
		),
	).toBe(true);
});

Then(
	"choice cards are visually subordinate to the stage question",
	async ({ page }) => {
		const hierarchy = await page.evaluate(() => {
			const question = document.querySelector<HTMLElement>(
				"[data-beat-phase] h2",
			);
			const choice = document.querySelector<HTMLElement>("[data-beat-choice]");
			if (!question || !choice) throw new Error("Missing projected choices");
			return {
				questionSize: Number.parseFloat(getComputedStyle(question).fontSize),
				choiceSize: Number.parseFloat(getComputedStyle(choice).fontSize),
			};
		});
		expect(hierarchy.questionSize).toBeGreaterThan(hierarchy.choiceSize * 1.5);
	},
);

Then(
	"the text-only stage is optically centered with a slight upper bias",
	async ({ page }) => {
		const geometry = await page.evaluate(() => {
			const frame = document.querySelector<HTMLElement>(
				"[data-classroom-stage-frame]",
			);
			const composition = document.querySelector<HTMLElement>(
				"[data-stage-composition]",
			);
			if (!frame || !composition)
				throw new Error("Missing classroom composition");
			const frameBox = frame.getBoundingClientRect();
			const compositionBox = composition.getBoundingClientRect();
			return {
				offset:
					compositionBox.top +
					compositionBox.height / 2 -
					(frameBox.top + frameBox.height / 2),
				maxBias: frameBox.height * 0.18,
			};
		});
		expect(geometry.offset).toBeLessThanOrEqual(0);
		expect(geometry.offset).toBeGreaterThanOrEqual(-geometry.maxBias);
	},
);

Then(
	"the resolution support is visually subordinate to the conclusion",
	async ({ page }) => {
		const hierarchy = await page.evaluate(() => {
			const conclusion = document.querySelector<HTMLElement>(
				'[data-beat-phase="resolution"] .classroom-stage-body',
			);
			const support = document.querySelector<HTMLElement>(
				"[data-resolution-support]",
			);
			if (!conclusion || !support)
				throw new Error("Missing resolution content");
			return {
				conclusionSize: Number.parseFloat(
					getComputedStyle(conclusion).fontSize,
				),
				supportSize: Number.parseFloat(getComputedStyle(support).fontSize),
			};
		});
		expect(hierarchy.conclusionSize).toBeGreaterThan(hierarchy.supportSize);
	},
);

Then("the current teacher cue is visible", async ({ page }) => {
	await expect(page.locator("[data-teacher-cue]")).toContainText(
		"Lees de situatie. Vertel nog niet wat Armstrong deed.",
	);
});

Then(
	"teacher and student guidance are separate aligned chunks",
	async ({ page }) => {
		const teacher = page.locator("[data-teacher-cue]");
		const student = page.locator("[data-student-action]");
		await expect(teacher).toBeVisible();
		await expect(student).toBeVisible();
		const layout = await Promise.all(
			[teacher, student].map((element) =>
				element.evaluate((node) => ({
					fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
					box: node.getBoundingClientRect().toJSON(),
				})),
			),
		);
		expect(layout.every(({ fontSize }) => fontSize >= 12)).toBe(true);
		const [teacherBox, studentBox] = layout.map(({ box }) => box);
		const overlaps =
			teacherBox.left < studentBox.right &&
			teacherBox.right > studentBox.left &&
			teacherBox.top < studentBox.bottom &&
			teacherBox.bottom > studentBox.top;
		expect(overlaps).toBe(false);
	},
);

Then("stage timing is labeled as suggested", async ({ page }) => {
	await expect(page.locator("[data-stage-timing]")).toHaveText(
		"Richttijd 20 sec.",
	);
});

Then(
	"the expected student action and stage timing are visible",
	async ({ page }) => {
		await expect(page.locator("[data-student-action]")).toContainText(
			"Bekijk de opties.",
		);
		await expect(page.locator("[data-stage-timing]")).toHaveText(
			"Richttijd 20 sec.",
		);
	},
);

Then(
	"the classroom sensitivity guidance is visible before starting",
	async ({ page }) => {
		await expect(page.locator("[data-classroom-sensitivity]")).toContainText(
			"Beoordeel de keuze met informatie uit dat moment.",
		);
	},
);

Then("classroom preparation attribution is not clipped", async ({ page }) => {
	const caption = page.locator(".classroom-preparation-visual figcaption");
	await expect(caption).toBeVisible();
	const geometry = await caption.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		overflowY: getComputedStyle(element).overflowY,
	}));
	expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
	expect(geometry.overflowY).not.toBe("hidden");
});

Then("duration choices show visible keyboard focus", async ({ page }) => {
	await page.getByLabel("5 minuten").focus();
	await expect(page.getByLabel("5 minuten").locator("..")).toHaveCSS(
		"outline-style",
		"solid",
	);
});

Then("enabled classroom actions use the pointer cursor", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Start", exact: true }),
	).toHaveCSS("cursor", "pointer");
});

Then("disabled classroom actions do not look interactive", async ({ page }) => {
	const back = page.getByRole("button", { name: "Terug", exact: true });
	await expect(back).toBeDisabled();
	await expect(back).toHaveCSS("cursor", "not-allowed");
});

Then("the classroom stage has keyboard focus", async ({ page }) => {
	await expect(page.locator("[data-classroom-stage-region]")).toBeFocused();
});

Then("the classroom stage has visible focus", async ({ page }) => {
	await expect
		.poll(() =>
			page
				.locator("[data-classroom-stage-region]")
				.evaluate((element) => element.matches(":focus-visible")),
		)
		.toBe(true);
});

Then("I see that the classroom beat is complete", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Klaar", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Lees het verhaal" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Terug naar start" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Opnieuw", exact: true }),
	).toBeVisible();
});

Then(
	"leaving the completed activity is the primary action",
	async ({ page }) => {
		await expect(
			page.getByRole("link", { name: "Terug naar start" }),
		).toHaveClass(/primary-button/);
	},
);

Then(
	"replaying the completed activity is a tertiary action",
	async ({ page }) => {
		await expect(
			page.getByRole("button", { name: "Opnieuw", exact: true }),
		).toHaveClass(/text-button/);
	},
);

Then("I see the classroom beat preparation again", async ({ page }) => {
	await expect(page.getByText("Kies de duur", { exact: true })).toBeVisible();
});

Then(
	"the preparation heading has not stolen keyboard focus",
	async ({ page }) => {
		await expect(page.locator("[data-beat-preparation]")).not.toBeFocused();
	},
);

Then("the preparation heading has keyboard focus", async ({ page }) => {
	await expect(page.locator("[data-beat-preparation]")).toBeFocused();
});

Then("the completion heading has keyboard focus", async ({ page }) => {
	await expect(page.locator("[data-beat-completed]")).toBeFocused();
});

Then(
	"the classroom presentation stays within the viewport",
	async ({ page }) => {
		const geometry = await page.evaluate(() => ({
			viewportHeight: window.innerHeight,
			viewportWidth: window.innerWidth,
			documentHeight: document.documentElement.scrollHeight,
			documentWidth: document.documentElement.scrollWidth,
		}));
		expect(geometry.documentHeight).toBeLessThanOrEqual(
			geometry.viewportHeight + 1,
		);
		expect(geometry.documentWidth).toBeLessThanOrEqual(
			geometry.viewportWidth + 1,
		);
	},
);

Then("the classroom state fits without scrolling", async ({ page }) => {
	const geometry = await page.evaluate(() => {
		const region = document.querySelector<HTMLElement>(
			"[data-classroom-stage-region]",
		);
		const stage = document.querySelector<HTMLElement>("[data-beat-phase]");
		if (!region || !stage) throw new Error("Missing classroom state");
		const regionRect = region.getBoundingClientRect();
		const stageRect = stage.getBoundingClientRect();
		return {
			viewportHeight: window.innerHeight,
			documentHeight: document.documentElement.scrollHeight,
			bodyHeight: document.body.scrollHeight,
			regionClientHeight: region.clientHeight,
			regionScrollHeight: region.scrollHeight,
			stageTop: stageRect.top,
			stageBottom: stageRect.bottom,
			regionTop: regionRect.top,
			regionBottom: regionRect.bottom,
		};
	});

	expect(geometry.documentHeight).toBeLessThanOrEqual(
		geometry.viewportHeight + 1,
	);
	expect(geometry.bodyHeight).toBeLessThanOrEqual(geometry.viewportHeight + 1);
	expect(geometry.regionScrollHeight).toBeLessThanOrEqual(
		geometry.regionClientHeight + 1,
	);
	expect(geometry.stageTop).toBeGreaterThanOrEqual(geometry.regionTop - 1);
	expect(geometry.stageBottom).toBeLessThanOrEqual(geometry.regionBottom + 1);
});

Then(
	"classroom preparation fits the viewport without scrolling",
	async ({ page }) => {
		const geometry = await page.evaluate(() => ({
			viewportHeight: window.innerHeight,
			documentHeight: document.documentElement.scrollHeight,
			bodyHeight: document.body.scrollHeight,
		}));
		expect(geometry.documentHeight).toBeLessThanOrEqual(
			geometry.viewportHeight + 1,
		);
		expect(geometry.bodyHeight).toBeLessThanOrEqual(
			geometry.viewportHeight + 1,
		);
	},
);

Then("the preparation title has a readable line measure", async ({ page }) => {
	const title = page.locator("[data-beat-preparation]");
	const lineCount = await title.evaluate((element) => {
		const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
		return Math.round(element.getBoundingClientRect().height / lineHeight);
	});
	expect(lineCount).toBeLessThanOrEqual(4);
});

Then(
	"classroom preparation actions are visible without scrolling",
	async ({ page }) => {
		const actions = page.locator(".classroom-preparation-actions");
		await expect(actions).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Start", exact: true }),
		).toBeInViewport();
		await expect(
			page.getByRole("link", { name: "Lees het verhaal", exact: true }),
		).toBeInViewport();
		const geometry = await actions.evaluate((element) => {
			const panel = element.closest("[data-beat-preparation-panel]");
			if (!panel) throw new Error("Missing preparation panel");
			const panelRect = panel.getBoundingClientRect();
			const actionsRect = element.getBoundingClientRect();
			return {
				actionsTop: actionsRect.top,
				actionsBottom: actionsRect.bottom,
				panelTop: panelRect.top,
				panelBottom: panelRect.bottom,
			};
		});
		expect(geometry.actionsTop).toBeGreaterThanOrEqual(geometry.panelTop - 1);
		expect(geometry.actionsBottom).toBeLessThanOrEqual(
			geometry.panelBottom + 1,
		);
	},
);

Then(
	"the visual classroom stage uses the available stage height",
	async ({ page }) => {
		const stage = page.locator("[data-stage-visual-layout]");
		const region = page.locator("[data-classroom-stage-region]");
		const [stageBox, regionBox] = await Promise.all([
			stage.boundingBox(),
			region.boundingBox(),
		]);
		if (!stageBox || !regionBox) throw new Error("Missing visual stage");
		expect(stageBox.y).toBeGreaterThanOrEqual(regionBox.y - 1);
		expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(
			regionBox.y + regionBox.height + 1,
		);
		expect(stageBox.height).toBeGreaterThan(regionBox.height / 2);
	},
);

Then(
	"all source comparison content is complete or recoverably scrollable",
	async ({ page }) => {
		const elements = page.locator(
			'[data-beat-mechanic="source-duel"] :is(.classroom-stage-body, [data-source-excerpt], .classroom-source-card-citation, [data-source-citation])',
		);
		await expect(elements).toHaveCount(5);
		for (const element of await elements.all()) {
			const geometry = await element.evaluate((node) => {
				const region = node.closest<HTMLElement>(
					"[data-classroom-stage-region]",
				);
				return {
					clientHeight: node.clientHeight,
					scrollHeight: node.scrollHeight,
					regionCanScroll: Boolean(
						region &&
							region.scrollHeight > region.clientHeight + 1 &&
							["auto", "scroll"].includes(getComputedStyle(region).overflowY),
					),
				};
			});
			const complete = geometry.scrollHeight <= geometry.clientHeight + 2;
			expect(complete || geometry.regionCanScroll).toBe(true);
		}
	},
);

Then("source cards use a readable comparison layout", async ({ page }) => {
	const cards = page.locator("[data-source-card]");
	const boxes = await cards.evaluateAll((elements) =>
		elements.map((element) => element.getBoundingClientRect().toJSON()),
	);
	if ((page.viewportSize()?.width ?? 0) < 640) {
		expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom - 1);
		expect(Math.min(...boxes.map(({ width }) => width))).toBeGreaterThanOrEqual(
			280,
		);
	} else {
		expect(Math.min(...boxes.map(({ width }) => width))).toBeGreaterThanOrEqual(
			240,
		);
	}
});

Then(
	"the classroom header shows the complete event title without clipping",
	async ({ page }) => {
		const title = page.locator(
			"[data-classroom-event-title], .classroom-runtime > header h1",
		);
		await expect(title).toHaveText(
			"D-Day: de geallieerde landing in Normandië",
		);
		const geometry = await title.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
			overflow: getComputedStyle(element).overflow,
		}));
		expect(geometry.scrollHeight).toBeLessThanOrEqual(
			geometry.clientHeight + 1,
		);
		expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
		expect(geometry.overflow).not.toBe("hidden");
	},
);

Then(
	"the classroom stage uses accessible overflow when content cannot fit",
	async ({ page }) => {
		const region = page.locator("[data-classroom-stage-region]");
		const geometry = await region.evaluate((element) => ({
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			overflowY: getComputedStyle(element).overflowY,
		}));
		expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight + 1);
		expect(geometry.overflowY).toBe("auto");
	},
);

Then(
	"the classroom signals that more stage content is available",
	async ({ page }) => {
		const hint = page.locator("[data-classroom-scroll-hint]");
		await expect(hint).toBeVisible();
		await expect(hint).toHaveText("Scroll voor meer");
	},
);

Then("all essential visual stage content is reachable", async ({ page }) => {
	for (const selector of [
		".classroom-stage-body",
		".classroom-stage--visual li",
		"[data-beat-perspective]",
		".classroom-stage-visual figcaption",
	]) {
		for (const element of await page.locator(selector).all()) {
			await element.scrollIntoViewIfNeeded();
			await expect(element).toBeInViewport();
		}
	}
});

Then(
	"the mobile classroom stage uses the available width",
	async ({ page }) => {
		const stage = page.locator("[data-classroom-stage-frame]");
		const box = await stage.boundingBox();
		const viewportWidth = page.viewportSize()?.width ?? 0;
		if (!box) throw new Error("Missing classroom stage");
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.width).toBeGreaterThan(viewportWidth - 24);
		const pageWidth = await page.evaluate(() =>
			Math.max(
				document.documentElement.scrollWidth,
				document.documentElement.clientWidth,
			),
		);
		expect(pageWidth).toBeLessThanOrEqual(viewportWidth);
	},
);

Then("the mobile classroom slide fits without scrolling", async ({ page }) => {
	const region = page.locator("[data-classroom-stage-region]");
	const geometry = await region.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
		overflowY: getComputedStyle(element).overflowY,
	}));
	expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
});

Then("classroom footer controls share one aligned row", async ({ page }) => {
	const footer = page.locator(".classroom-runtime > footer");
	const cue = footer.locator("[data-teacher-cue]");
	const buttons = footer.getByRole("button");
	const [cueBox, buttonBoxes] = await Promise.all([
		cue.boundingBox(),
		buttons.evaluateAll((elements) =>
			elements.map((element) => {
				const box = element.getBoundingClientRect();
				return {
					top: box.top,
					bottom: box.bottom,
					clientWidth: element.clientWidth,
					scrollWidth: element.scrollWidth,
				};
			}),
		),
	]);
	if (!cueBox || buttonBoxes.length === 0)
		throw new Error("Missing classroom footer layout");
	expect(new Set(buttonBoxes.map(({ top }) => Math.round(top))).size).toBe(1);
	expect(
		buttonBoxes.every(
			({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth,
		),
	).toBe(true);
	expect(Math.min(...buttonBoxes.map(({ top }) => top))).toBeGreaterThanOrEqual(
		cueBox.y + cueBox.height,
	);
});

When(
	"one wheel gesture scrolls the classroom content to its boundary",
	async ({ page }) => {
		await page.locator("[data-classroom-stage-region]").evaluate((element) => {
			for (const deltaY of [120, 180, 240]) {
				element.dispatchEvent(
					new WheelEvent("wheel", {
						bubbles: true,
						cancelable: true,
						deltaY,
					}),
				);
				element.scrollTop = element.scrollHeight;
			}
		});
	},
);

When(
	"I begin a fresh wheel gesture at the content boundary",
	async ({ page }) => {
		await page.waitForTimeout(500);
		await page.locator("[data-classroom-stage-region]").evaluate((element) => {
			element.dispatchEvent(
				new WheelEvent("wheel", {
					bubbles: true,
					cancelable: true,
					deltaY: 120,
				}),
			);
		});
	},
);

When("I send one low-resolution wheel burst down", async ({ page }) => {
	await page.locator("[data-classroom-stage-region]").evaluate((element) => {
		for (let eventIndex = 0; eventIndex < 5; eventIndex += 1) {
			element.dispatchEvent(
				new WheelEvent("wheel", {
					bubbles: true,
					cancelable: true,
					deltaY: 10,
				}),
			);
		}
	});
});

When("I send one fresh line-mode wheel notch up", async ({ page }) => {
	await page.waitForTimeout(500);
	await page.locator("[data-classroom-stage-region]").evaluate((element) => {
		element.dispatchEvent(
			new WheelEvent("wheel", {
				bubbles: true,
				cancelable: true,
				deltaMode: WheelEvent.DOM_DELTA_LINE,
				deltaY: -3,
			}),
		);
	});
});

When(
	"one touch gesture scrolls the classroom content to its boundary",
	async ({ page }) => {
		await page.locator("[data-classroom-stage-region]").evaluate((element) => {
			const dispatchTouch = (
				type: "touchstart" | "touchmove" | "touchend",
				y: number,
			) => {
				const touch = new Touch({
					identifier: 1,
					target: element,
					clientX: 320,
					clientY: y,
				});
				element.dispatchEvent(
					new TouchEvent(type, {
						bubbles: true,
						cancelable: true,
						touches: type === "touchend" ? [] : [touch],
						changedTouches: type === "touchend" ? [touch] : [],
					}),
				);
			};
			dispatchTouch("touchstart", 260);
			dispatchTouch("touchmove", 180);
			element.scrollTop = element.scrollHeight;
			dispatchTouch("touchend", 100);
		});
	},
);

When("I scroll down once in the classroom deck", async ({ page }) => {
	await page.locator("[data-classroom-stage-region]").hover();
	await page.mouse.wheel(0, 120);
});

When("I scroll up once in the classroom deck", async ({ page }) => {
	await page.waitForTimeout(500);
	await page.locator("[data-classroom-stage-region]").hover();
	await page.mouse.wheel(0, -120);
});

Then(
	"scrolling the classroom deck emits no console errors",
	async ({ page }) => {
		expect(classroomConsoleErrors.get(page) ?? []).toEqual([]);
	},
);

When("I swipe up once in the classroom deck", async ({ page }) => {
	await page.waitForTimeout(500);
	await page.locator("[data-classroom-stage-region]").evaluate((element) => {
		const start = new Touch({
			identifier: 1,
			target: element,
			clientX: 160,
			clientY: 360,
		});
		const end = new Touch({
			identifier: 1,
			target: element,
			clientX: 160,
			clientY: 260,
		});
		element.dispatchEvent(
			new TouchEvent("touchstart", { bubbles: true, touches: [start] }),
		);
		element.dispatchEvent(
			new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }),
		);
	});
});

Then("classroom controls fit without horizontal clipping", async ({ page }) => {
	const geometry = await page.locator("footer").evaluate((footer) => ({
		clientWidth: footer.clientWidth,
		scrollWidth: footer.scrollWidth,
		documentClientWidth: document.documentElement.clientWidth,
		documentScrollWidth: document.documentElement.scrollWidth,
	}));
	expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
	expect(geometry.documentScrollWidth).toBeLessThanOrEqual(
		geometry.documentClientWidth + 1,
	);
});

Then("classroom controls have touch-sized targets", async ({ page }) => {
	const targets = await page
		.locator("footer")
		.getByRole("button")
		.evaluateAll((buttons) =>
			buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				return { width: rect.width, height: rect.height };
			}),
		);
	expect(targets.length).toBeGreaterThan(0);
	expect(
		targets.every(({ width, height }) => width >= 44 && height >= 44),
	).toBe(true);
});
