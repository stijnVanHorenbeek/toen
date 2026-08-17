import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);

let serverFirstRecommendation = "";

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

When("I open the homepage filters", async ({ page }) => {
	await page.getByRole("button", { name: "Zoeken en voorkeuren" }).click();
});

When("I open the homepage filters if needed", async ({ page }) => {
	const search = page.getByLabel("Zoek op onderwerp of gebeurtenis");
	if (await search.isVisible()) return;
	await page.getByRole("button", { name: "Zoeken en voorkeuren" }).click();
});

Given(
	"I record the server-rendered first recommendation",
	async ({ request }) => {
		const response = await request.get("/");
		const html = await response.text();
		serverFirstRecommendation =
			/data-recommended-event[^>]*>[\s\S]*?<article[^>]*>[\s\S]*?<h2[^>]*>([^<]+)/.exec(
				html,
			)?.[1] ?? "";
		expect(serverFirstRecommendation).not.toBe("");
	},
);

When("I search activities for {string}", async ({ page }, query: string) => {
	await page.getByLabel("Zoek op onderwerp of gebeurtenis").fill(query);
});

When(
	"I rapidly replace the activity search with {string} and {string}",
	async ({ page }, first: string, second: string) => {
		const search = page.getByLabel("Zoek op onderwerp of gebeurtenis");
		await search.fill(first);
		await search.fill(second);
	},
);

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

Then("a static event archive link is available", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Blader door alle gebeurtenissen" }),
	).toHaveAttribute("href", "/archive");
});

When("I open the static event archive", async ({ page }) => {
	await page
		.getByRole("link", { name: "Blader door alle gebeurtenissen" })
		.click();
});

Then("period and topic archive links are available", async ({ page }) => {
	await expect(page).toHaveURL(/\/archive$/);
	await expect(
		page.getByRole("heading", { name: "Per periode" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Per onderwerp" }),
	).toBeVisible();
	await expect(
		page.locator('a[href^="/archive/periods/"]').first(),
	).toBeVisible();
	await expect(
		page.locator('a[href^="/archive/topics/"]').first(),
	).toBeVisible();
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
			page.getByRole("region", { name: "Zoeken en voorkeuren" }),
		).toBeVisible();
	},
);

Then(
	"compact filter access appears before the featured recommendation",
	async ({ page }) => {
		const [trigger, featured] = await Promise.all([
			page.getByRole("button", { name: "Zoeken en voorkeuren" }).boundingBox(),
			page.locator("[data-featured-recommendation]").boundingBox(),
		]);
		if (!trigger || !featured) throw new Error("Missing discovery layout");
		expect(trigger.y).toBeLessThan(featured.y);
	},
);

Then("the activity search receives focus", async ({ page }) => {
	await expect(
		page.getByLabel("Zoek op onderwerp of gebeurtenis"),
	).toBeFocused();
});

Then(
	"topic choices say they give matching activities priority",
	async ({ page }) => {
		await expect(
			page.getByText("Geef passende activiteiten voorrang", { exact: true }),
		).toBeVisible();
	},
);

Then(
	"only the first recommendation uses the featured treatment",
	async ({ page }) => {
		await expect(page.locator("[data-featured-recommendation]")).toHaveCount(1);
		await expect(
			page.locator("[data-compact-recommendation]").first(),
		).toBeVisible();
	},
);

Then(
	"a secondary recommendation is shorter than the featured recommendation",
	async ({ page }) => {
		const [featured, compact] = await Promise.all([
			page.locator("[data-featured-recommendation]").boundingBox(),
			page.locator("[data-compact-recommendation]").first().boundingBox(),
		]);
		if (!featured || !compact) throw new Error("Missing recommendation cards");
		expect(compact.height).toBeLessThan(featured.height * 0.7);
	},
);

Then(
	"secondary recommendation titles open background reading",
	async ({ page }) => {
		const recommendations = page.locator("[data-compact-recommendation]");
		for (const recommendation of await recommendations.all()) {
			const heading = recommendation.getByRole("heading", { level: 2 });
			const title = (await heading.textContent())?.trim();
			expect(title).toBeTruthy();
			await expect(
				recommendation.getByRole("link", { name: title }),
			).toHaveAttribute("href", /\/events\/[^/]+$/);
		}
	},
);

Then("secondary classroom starts use quiet actions", async ({ page }) => {
	const recommendations = page.locator("[data-compact-recommendation]");
	for (const recommendation of await recommendations.all()) {
		await expect(
			recommendation.getByRole("link", { name: "Start activiteit" }),
		).not.toHaveClass(/primary-button/);
	}
});

Then(
	"recommendation cards follow the page heading hierarchy",
	async ({ page }) => {
		const recommendations = page.locator("[data-recommended-event]");
		await expect(recommendations.locator("h2")).toHaveCount(
			await recommendations.count(),
		);
		await expect(recommendations.locator("h3")).toHaveCount(0);
	},
);

Then("the hydrated first recommendation is unchanged", async ({ page }) => {
	await page.waitForTimeout(100);
	await expect(page.locator("[data-featured-recommendation] h2")).toHaveText(
		serverFirstRecommendation,
	);
});

Then("activity fit is exposed as a named list", async ({ page }) => {
	await expect(
		page
			.locator("[data-recommended-event]")
			.first()
			.getByRole("list", { name: "Waarom deze activiteit past" }),
	).toBeVisible();
});

Then(
	"filter grouping is quiet while filter controls remain bounded",
	async ({ page }) => {
		const grouping = page.locator("[data-passive-group='filters']");
		await expect(grouping).toHaveCSS("border-top-width", "0px");
		await expect(grouping).toHaveCSS(
			"background-color",
			"rgba(255, 255, 255, 0.38)",
		);
		await expect(page.getByLabel("Zoek op onderwerp of gebeurtenis")).toHaveCSS(
			"border-top-width",
			"1px",
		);
	},
);

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
