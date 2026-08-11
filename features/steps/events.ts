import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Then, When } = createBdd(test);

When("I choose the week {string}", async ({ page }, date: string) => {
	const dateFilters = page.locator("summary", {
		hasText: "Datum en periode",
	});
	if (!(await page.getByLabel("Lesweek").isVisible()))
		await dateFilters.click();
	await page.getByLabel("Lesweek").fill(date);
});

When(
	"I set the period from {string} to {string}",
	async ({ page }, yearMin: string, yearMax: string) => {
		await page.getByLabel("Van jaar").fill(yearMin);
		await page.getByLabel("Tot jaar").fill(yearMax);
	},
);

When("I open the first recommended event", async ({ page }) => {
	await page
		.locator("[data-recommended-event]")
		.first()
		.getByRole("link", { name: "Lees achtergrond" })
		.click();
	await expect(page).toHaveURL(/\/events\/[^/]+$/);
});

Then("the event heading matches the page title", async ({ page }) => {
	const heading = page.getByRole("heading", { level: 1 });
	await expect(heading).toBeVisible();
	await expect(page).toHaveTitle(`${await heading.textContent()} | Toen.`);
});

Then("the event shows at least one attributed source", async ({ page }) => {
	const source = page.getByRole("complementary").getByRole("listitem").first();
	await expect(source.getByRole("link")).toHaveAttribute(
		"href",
		/^https?:\/\//,
	);
	await expect(source.locator("p")).not.toHaveText("");
});

Then("I see that the period was widened", async ({ page }) => {
	await expect(page.getByRole("status")).toBeVisible();
});

Then("I see at least one recommended event", async ({ page }) => {
	await expect(page.locator("[data-recommended-event]").first()).toBeVisible();
});
