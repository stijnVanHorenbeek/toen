import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);

Given("I open the event admin", async ({ page }) => {
	await page.goto("/admin");
});

Given("GitHub publishing is in dry-run mode", async ({ page }) => {
	await page.route("**/api/admin/events/publish", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				status: "dry-run",
				path: "content/events/val-van-constantinopel-1453.md",
				markdown: "title: Constantinopel valt",
			}),
		});
	});
});

Given("Markdown preview responses are delayed", async ({ page }) => {
	await page.route("**/api/admin/events/preview", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 300));
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				path: "content/events/val-van-constantinopel-1453.md",
				markdown: "title: Constantinopel valt",
			}),
		});
	});
});

Given("GitHub publishing creates a pull request", async ({ page }) => {
	await page.route("**/api/admin/events/publish", async (route) => {
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({
				status: "created",
				path: "content/events/val-van-constantinopel-1453.md",
				markdown: "title: Constantinopel valt",
				pullRequestNumber: 17,
				pullRequestUrl: "https://github.com/example/toen/pull/17",
			}),
		});
	});
});

When("I complete a valid event draft", async ({ page }) => {
	await page.getByLabel("Slug").fill("val-van-constantinopel-1453");
	await page.getByLabel("Titel", { exact: true }).fill("Constantinopel valt");
	await page.getByLabel("Jaar").fill("1453");
	await page.getByLabel("Maand").fill("5");
	await page.getByLabel("Dag").fill("29");
	await page
		.getByLabel("Samenvatting")
		.fill("Ottomaanse troepen nemen Constantinopel in.");
	await page.getByLabel("Onderwerpen").fill("politiek, oorlog");
	await page.getByLabel("Profielen").fill("algemeen");
	await page.getByLabel("Brontitel").fill("Fall of Constantinople");
	await page.getByLabel("Bronuitgever").fill("Encyclopaedia Britannica");
	await page
		.getByLabel("Bron-URL")
		.fill("https://www.britannica.com/event/Fall-of-Constantinople-1453");
	await page
		.getByLabel("Markdowntekst")
		.fill("De stad werd na een beleg ingenomen.");
});

When("I request the Markdown preview", async ({ page }) => {
	await page.getByRole("button", { name: "Genereer preview" }).click();
});

When("I request a pull request", async ({ page }) => {
	await page.getByRole("button", { name: "Maak pull request" }).click();
});

When("I change the title before the preview returns", async ({ page }) => {
	await page.getByLabel("Titel", { exact: true }).fill("Gewijzigde titel");
});

Then("the target event path is {string}", async ({ page }, path: string) => {
	await expect(page.getByText(path, { exact: true })).toBeVisible();
});

Then(
	"the Markdown preview contains {string}",
	async ({ page }, content: string) => {
		await expect(page.getByTestId("markdown-preview")).toContainText(content);
	},
);

Then("I see that nothing was written to GitHub", async ({ page }) => {
	await expect(page.getByText("Niets naar GitHub geschreven")).toBeVisible();
});

Then("the stale draft cannot be published", async ({ page }) => {
	await page.waitForTimeout(400);
	await expect(page.getByTestId("markdown-preview")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Maak pull request" }),
	).toBeDisabled();
});

Then("the created pull request is shown", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Open op GitHub" }),
	).toHaveAttribute("href", "https://github.com/example/toen/pull/17");
});

Then("the same draft cannot be published again", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Maak pull request" }),
	).toBeDisabled();
});
