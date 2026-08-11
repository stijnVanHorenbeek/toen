import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);

Given("I open the Apollo 11 classroom beat", async ({ page }) => {
	await page.goto("/events/apollo-11-1969/play");
});

Given("I open the Constantinople classroom route", async ({ page }) => {
	await page.goto("/events/val-van-constantinopel-1453/play");
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
	await page.getByRole("button", { name: "Start klasbeat" }).click();
	await expect(page.locator('[data-beat-stage="opening"]')).toBeVisible({
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

When("I reload the classroom beat", async ({ page }) => {
	await page.reload();
});

When(
	"I advance to classroom stage {string}",
	async ({ page }, stageId: string) => {
		const target = page.locator(`[data-beat-stage="${stageId}"]`);
		for (let step = 0; step < 16 && !(await target.isVisible()); step += 1) {
			await page
				.getByRole("button", { name: /^(Volgende|Onthul bewijs)$/ })
				.click();
		}
		await expect(target).toBeVisible();
	},
);

When("I press the classroom key {string}", async ({ page }, key: string) => {
	await page.keyboard.press(key);
});

Then(
	"beat stage {string} shows {string}",
	async ({ page }, stageId: string, text: string) => {
		const stage = page.locator(`[data-beat-stage="${stageId}"]`);
		await expect(stage).toBeVisible();
		await expect(stage).toContainText(text);
	},
);

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
		page.getByRole("heading", { name: "Klasbeat afgerond" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Terug naar het achtergrondverhaal" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Naar startpagina" }),
	).toBeVisible();
});

Then("I see the classroom beat preparation again", async ({ page }) => {
	await expect(
		page.getByText("Klasbeat voorbereiden", { exact: true }),
	).toBeVisible();
});

Then("the preparation heading has keyboard focus", async ({ page }) => {
	await expect(page.locator("[data-beat-preparation]")).toBeFocused();
});

Then("the completion heading has keyboard focus", async ({ page }) => {
	await expect(page.locator("[data-beat-completed]")).toBeFocused();
});

Then("I see the reload reset explanation", async ({ page }) => {
	await expect(
		page.getByText("Herladen start deze klasbeat opnieuw."),
	).toBeVisible();
});

Then("the classroom state fits without scrolling", async ({ page }) => {
	const geometry = await page.evaluate(() => {
		const region = document.querySelector<HTMLElement>(
			"[data-classroom-stage-region]",
		);
		const stage = document.querySelector<HTMLElement>("[data-beat-stage]");
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

Then("classroom controls have touch-sized targets", async ({ page }) => {
	const targets = await page
		.locator(".classroom-runtime footer button")
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

Then("I see that no classroom beat is ready", async ({ page }) => {
	await expect(
		page.getByText("Voor deze gebeurtenis is nog geen klasbeat klaar."),
	).toBeVisible();
});

Then("I can return to the Constantinople article", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Lees het achtergrondverhaal" }),
	).toHaveAttribute("href", "/events/val-van-constantinopel-1453");
});
