import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Then, When } = createBdd(test);

When("I choose the week {string}", async ({ page }, date: string) => {
	await page.getByLabel("Week").fill(date);
});

When(
	"I set the period from {string} to {string}",
	async ({ page }, yearMin: string, yearMax: string) => {
		await page.getByLabel("Van jaar").fill(yearMin);
		await page.getByLabel("Tot jaar").fill(yearMax);
	},
);

When("I open the event {string}", async ({ page }, title: string) => {
	await page.getByRole("link", { name: title }).click();
});

Then("I see the event heading {string}", async ({ page }, title: string) => {
	await expect(
		page.getByRole("heading", { level: 1, name: title }),
	).toBeVisible();
});

Then("I see the source {string}", async ({ page }, title: string) => {
	await expect(
		page.getByRole("link", { name: title, exact: true }),
	).toBeVisible();
});

Then("I see that the period was widened", async ({ page }) => {
	await expect(
		page.getByText("Geen gebeurtenis in deze periode"),
	).toBeVisible();
});

Then("I see at least one recommended event", async ({ page }) => {
	await expect(page.locator("[data-recommended-event]").first()).toBeVisible();
});
