import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then } = createBdd(test);

Given("I open the homepage", async ({ page }) => {
	await page.goto("/");
});

Then("the page title is {string}", async ({ page }, title: string) => {
	await expect(page).toHaveTitle(title);
});

Then("the heading {string} is visible", async ({ page }, name: string) => {
	await expect(page.getByRole("heading", { name })).toBeVisible();
});
