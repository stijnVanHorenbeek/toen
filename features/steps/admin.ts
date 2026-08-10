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

Given("GitHub publishing commits and triggers deployment", async ({ page }) => {
	await page.route("**/api/admin/events/publish", async (route) => {
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify(publishResult("committed-and-triggered", "created")),
		});
	});
});

Given(
	"GitHub publishing saves a commit before deployment triggering fails",
	async ({ page }) => {
		let attempt = 0;
		await page.route("**/api/admin/events/publish", async (route) => {
			attempt += 1;
			await route.fulfill({
				status: attempt === 1 ? 202 : 200,
				contentType: "application/json",
				body: JSON.stringify(
					publishResult(
						attempt === 1
							? "committed-trigger-failed"
							: "committed-and-triggered",
						attempt === 1 ? "created" : "unchanged",
					),
				),
			});
		});
	},
);

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

When("I request publication", requestPublication);
When("I request publication again", requestPublication);

When("I change the title before the preview returns", async ({ page }) => {
	await page.getByLabel("Titel", { exact: true }).fill("Gewijzigde titel");
});

Then(
	"the target event path is {string}",
	async ({ page }, expectedPath: string) => {
		await expect(page.getByText(expectedPath, { exact: true })).toBeVisible();
	},
);

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
		page.getByRole("button", { name: "Publiceer gebeurtenis" }),
	).toBeDisabled();
});

Then("the created commit is shown", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Open commit op GitHub" }),
	).toHaveAttribute(
		"href",
		"https://github.com/example/toen-content/commit/commit-sha",
	);
});

Then(
	"I see that the commit was saved but deployment needs a retry",
	async ({ page }) => {
		await expect(page.getByText("Commit opgeslagen")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Publiceer gebeurtenis" }),
		).toBeEnabled();
	},
);

Then("the same draft cannot be published again", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Publiceer gebeurtenis" }),
	).toBeDisabled();
});

async function requestPublication({
	page,
}: {
	page: import("@playwright/test").Page;
}) {
	await page.getByRole("button", { name: "Publiceer gebeurtenis" }).click();
}

function publishResult(
	status: "committed-and-triggered" | "committed-trigger-failed",
	change: "created" | "unchanged",
) {
	return {
		status,
		change,
		path: "content/events/val-van-constantinopel-1453.md",
		markdown: "title: Constantinopel valt",
		commitSha: "commit-sha",
		commitUrl: "https://github.com/example/toen-content/commit/commit-sha",
	};
}
