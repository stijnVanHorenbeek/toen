import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);

Given("I open the Apollo 11 classroom beat", async ({ page }) => {
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
	await page.getByText("5 minuten", { exact: true }).click();
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

When("I choose to stop but cancel", async ({ page }) => {
	page.once("dialog", async (dialog) => {
		expect(dialog.type()).toBe("confirm");
		await dialog.dismiss();
	});
	await page.getByRole("button", { name: "Stoppen", exact: true }).click();
});

When("I stop the classroom beat with Escape and confirm", async ({ page }) => {
	page.once("dialog", async (dialog) => {
		expect(dialog.type()).toBe("confirm");
		await dialog.accept();
	});
	await page.keyboard.press("Escape");
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

Then("two attributed source cards are visible", async ({ page }) => {
	const cards = page.locator("[data-source-card]");
	await expect(cards).toHaveCount(2);
	for (const card of await cards.all()) {
		await expect(card.locator("cite")).toBeVisible();
	}
});

Then(
	"classroom progress is step {int} of {int}",
	async ({ page }, step: number, total: number) => {
		await expect(
			page.getByText(`Stap ${step} van ${total}`, { exact: true }),
		).toBeVisible();
	},
);

Then("the context decision perspective is visible", async ({ page }) => {
	await expect(page.locator("[data-beat-perspective]")).toBeVisible();
});

Then("the current teacher cue is visible", async ({ page }) => {
	await expect(page.locator("[data-teacher-cue]")).toContainText(
		"Lees de situatie. Vertel nog niet wat Armstrong deed.",
	);
});

Then("duration choices show visible keyboard focus", async ({ page }) => {
	await page.getByLabel("5 minuten").focus();
	await expect(page.getByText("5 minuten", { exact: true })).toHaveCSS(
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
		page.getByRole("button", { name: "Nog een keer" }),
	).toBeVisible();
});

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
