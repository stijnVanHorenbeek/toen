import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);

Given("I open the homepage", async ({ page }) => {
	await page.goto("/");
});

Given(
	"the homepage viewport is {int} by {int}",
	async ({ page }, width: number, height: number) => {
		await page.setViewportSize({ width, height });
	},
);

Then("the page title is {string}", async ({ page }, title: string) => {
	await expect(page).toHaveTitle(title);
});

Then("the site name {string} is visible", async ({ page }, name: string) => {
	await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

Then("the heading {string} is visible", async ({ page }, name: string) => {
	await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

Then("I can create a new activity", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Nieuwe activiteit" }),
	).toHaveAttribute("href", "/admin");
});

Then(
	"a classroom start action is visible in the first viewport",
	async ({ page }) => {
		const action = page
			.locator("[data-recommended-event]")
			.first()
			.getByRole("link", { name: "Start activiteit" });
		await expect(action).toBeVisible();
		const box = await action.boundingBox();
		expect(box).not.toBeNull();
		expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
			page.viewportSize()?.height ?? 0,
		);
	},
);

When("I start the first recommended classroom activity", async ({ page }) => {
	await page
		.locator("[data-recommended-event]")
		.first()
		.getByRole("link", { name: "Start activiteit" })
		.click();
	await expect(page).toHaveURL(/\/events\/[^/]+\/play$/);
});

Then("I see the classroom activity preparation", async ({ page }) => {
	await expect(page.locator("[data-beat-preparation]")).toBeVisible();
	await expect(page.getByLabel("8 minuten")).toBeChecked();
});

When("I search activities for {string}", async ({ page }, query: string) => {
	await page.getByLabel("Zoek op onderwerp of gebeurtenis").fill(query);
});

When("I choose the topic {string}", async ({ page }, topic: string) => {
	await page.getByLabel(topic, { exact: true }).check();
});

Then(
	"the first recommended activity starts {string}",
	async ({ page }, path: string) => {
		await expect(
			page
				.locator("[data-recommended-event]")
				.first()
				.getByRole("link", { name: "Start activiteit" }),
		).toHaveAttribute("href", path);
	},
);

Then("the recommendation explains why it fits", async ({ page }) => {
	const fit = page
		.locator("[data-recommended-event]")
		.first()
		.getByRole("list", { name: "Waarom deze activiteit past" });
	await expect(fit).toContainText("Komt overeen met je zoekopdracht");
	await expect(fit).toContainText("Oorlog");
});

When("I tab to the first classroom start action", async ({ page }) => {
	for (let step = 0; step < 24; step += 1) {
		await page.keyboard.press("Tab");
		const href = await page.evaluate(
			() => document.activeElement?.getAttribute("href") ?? "",
		);
		if (/\/events\/[^/]+\/play$/.test(href)) return;
	}
	throw new Error("Classroom start action was not reachable by keyboard");
});

Then(
	"the first classroom start action has keyboard focus",
	async ({ page }) => {
		await expect(
			page
				.locator("[data-recommended-event]")
				.first()
				.getByRole("link", { name: "Start activiteit" }),
		).toBeFocused();
	},
);

Then(
	"recommendation and filter regions have accessible names",
	async ({ page }) => {
		await expect(
			page.getByRole("region", { name: "Kies een activiteit" }),
		).toBeVisible();
		await expect(
			page.getByRole("region", { name: "Zoeken en filteren" }),
		).toBeVisible();
	},
);

Then("activity fit is exposed as a named list", async ({ page }) => {
	await expect(
		page
			.locator("[data-recommended-event]")
			.first()
			.getByRole("list", { name: "Waarom deze activiteit past" }),
	).toBeVisible();
});

Then("the homepage fits without horizontal scrolling", async ({ page }) => {
	const geometry = await page.evaluate(() => ({
		clientWidth: document.documentElement.clientWidth,
		scrollWidth: document.documentElement.scrollWidth,
	}));
	expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});

Then("homepage controls have touch-sized targets", async ({ page }) => {
	const targets = page.locator(
		"a, button, summary, input:not([type=checkbox]), select, label:has(input[type=checkbox])",
	);
	const sizes = await targets.evaluateAll((elements) =>
		elements.flatMap((element) => {
			const rect = element.getBoundingClientRect();
			return rect.width > 0 && rect.height > 0
				? [{ width: rect.width, height: rect.height }]
				: [];
		}),
	);
	expect(sizes.length).toBeGreaterThan(0);
	expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
		true,
	);
});
