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

When("I clear the from year", async ({ page }) => {
	await openDateFilters(page);
	await page.getByLabel("Van jaar").clear();
});

When("I enter the from year {string}", async ({ page }, year: string) => {
	await page.getByLabel("Van jaar").fill(year);
});

When("I type the BCE from year {string}", async ({ page }, year: string) => {
	await openDateFilters(page);
	const field = page.getByLabel("Van jaar");
	await field.clear();
	await field.pressSequentially(year);
});

Then("the from year remains empty while I edit", async ({ page }) => {
	await expect(page.getByLabel("Van jaar")).toHaveValue("");
});

Then("the from year is {string}", async ({ page }, year: string) => {
	await expect(page.getByLabel("Van jaar")).toHaveValue(year);
});

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

Then(
	"the article quietly introduces the classroom activity",
	async ({ page }) => {
		const introduction = page.locator("[data-article-activity-introduction]");
		await expect(introduction).toContainText(
			/(Kiezen en herzien|Bronnen vergelijken|Beslissen met context)/,
		);
		await expect(introduction).toContainText("5 · 8 · 12 min");
		await expect(
			introduction.locator("[data-activity-question]"),
		).toContainText(/\S+\?$/);
		await expect(
			introduction.getByRole("link", { name: "Start activiteit" }),
		).toHaveCount(0);
	},
);

Then(
	"the article has one prominent classroom activity action at the end",
	async ({ page }) => {
		const article = page.locator("article");
		const actions = article.getByRole("link", { name: "Start activiteit" });
		await expect(actions).toHaveCount(1);
		const action = article
			.locator("[data-article-activity-continuation]")
			.getByRole("link", { name: "Start activiteit" });
		await expect(action).toHaveClass(/primary-button/);
		const [articleBox, actionBox] = await Promise.all([
			article.boundingBox(),
			action.boundingBox(),
		]);
		if (!articleBox || !actionBox)
			throw new Error("Missing article continuation");
		expect(actionBox.y).toBeGreaterThan(articleBox.y + articleBox.height * 0.7);
	},
);

Then("I see that the period was widened", async ({ page }) => {
	await expect(page.getByRole("status")).toBeVisible();
});

Then("I see at least one recommended event", async ({ page }) => {
	await expect(page.locator("[data-recommended-event]").first()).toBeVisible();
});

async function openDateFilters(page: import("@playwright/test").Page) {
	if (!(await page.getByLabel("Van jaar").isVisible())) {
		await page.locator("summary", { hasText: "Datum en periode" }).click();
	}
}
