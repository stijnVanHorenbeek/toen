import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);
let pendingPreviewResponse: Promise<unknown> | null = null;

type ClipboardTestWindow = Window & { copiedChatGptInstructions?: string };

Given("the browser clipboard accepts copied instructions", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (value: string) => {
					(window as ClipboardTestWindow).copiedChatGptInstructions = value;
				},
			},
		});
	});
});

Given("the browser clipboard rejects copied instructions", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async () => {
					throw new DOMException("Clipboard denied", "NotAllowedError");
				},
			},
		});
	});
});

Given("I open the event admin", async ({ page }) => {
	await page.goto("/admin");
});

Given("GitHub publishing is in dry-run mode", async ({ page }) => {
	await page.route("**/api/admin/events/publish", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ status: "dry-run", ...previewResult() }),
		});
	});
});

Given("preview responses fail without structured errors", async ({ page }) => {
	await page.route("**/api/admin/events/preview", async (route) => {
		await route.fulfill({ status: 502, body: "upstream unavailable" });
	});
});

Given("preview responses are delayed", async ({ page }) => {
	await page.route("**/api/admin/events/preview", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 300));
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(previewResult()),
		});
	});
});

Given("publish responses are delayed", async ({ page }) => {
	await page.route("**/api/admin/events/publish", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 500));
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify(publishResult("committed-and-triggered", "created")),
		});
	});
});

Given("browser draft cleanup fails", async ({ page }) => {
	await page.addInitScript(() => {
		Storage.prototype.removeItem = () => {
			throw new Error("storage unavailable");
		};
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

Given("a local event draft exists", async ({ page }) => {
	await installStoredDraft(page, 1);
});

Given("a local review-stage event draft exists", async ({ page }) => {
	await installStoredDraft(page, 3);
});

When("I choose help from ChatGPT", async ({ page }) => {
	await page
		.locator("summary")
		.filter({ hasText: "Begin met hulp van ChatGPT" })
		.click();
});

When("I prepare ChatGPT help for {string}", async ({ page }, topic: string) => {
	await page.getByLabel("Onderwerp of gebeurtenis").fill(topic);
	await page
		.getByLabel("Extra lescontext (optioneel)")
		.fill("Laat leerlingen bewijs afwegen zonder persoonlijke gegevens.");
	await page.getByLabel("Voorkeursduur").selectOption("12");
	await page
		.getByLabel("Werkvorm voor de activiteit")
		.selectOption("source-duel");
	await page.getByLabel("Antwoordvorm").selectOption("response-cards");
});

When("I type the story title {string}", async ({ page }, title: string) => {
	await page.getByLabel("Titel").fill(title);
});

When("I enter only spaces as the ChatGPT topic", async ({ page }) => {
	await page.getByLabel("Onderwerp of gebeurtenis").fill("   ");
});

When(
	"I change the ChatGPT topic to {string}",
	async ({ page }, topic: string) => {
		await page.getByLabel("Onderwerp of gebeurtenis").fill(topic);
	},
);

When("I make the ChatGPT instructions", async ({ page }) => {
	await page.getByRole("button", { name: "Instructies maken" }).click();
});

When("I copy the ChatGPT instructions", async ({ page }) => {
	await page.getByRole("button", { name: "Instructies kopiëren" }).click();
});

When("active ChatGPT request storage disappears", async ({ page }) => {
	await page.evaluate(() =>
		sessionStorage.removeItem("toen:chatgpt-request:v1"),
	);
});

When(
	"I paste a complete ChatGPT answer titled {string}",
	async ({ page }, title: string) => {
		const response = await completeChatGptAnswer(page);
		(response.draft as Record<string, unknown>).title = title;
		await page
			.getByLabel("Antwoord van ChatGPT")
			.fill(JSON.stringify(response));
	},
);

When(
	"I paste a complete ChatGPT answer titled {string} with a long unbroken second source title",
	async ({ page }, title: string) => {
		const response = await completeChatGptAnswer(page);
		response.draft.title = title;
		const sources = response.draft.sources as Array<Record<string, unknown>>;
		sources[1].title = "bron".repeat(60);
		sources[1].publisher = "uitgever".repeat(20);
		const claims = (
			response as unknown as { claims: Array<Record<string, unknown>> }
		).claims;
		claims[0].uncertainty = "onzekerheid".repeat(45);
		await page
			.getByLabel("Antwoord van ChatGPT")
			.fill(JSON.stringify(response));
	},
);

When(
	"I paste the malformed ChatGPT answer {string}",
	async ({ page }, value: string) => {
		await page.getByLabel("Antwoord van ChatGPT").fill(value);
	},
);

When("I paste a stale ChatGPT answer", async ({ page }) => {
	const response = await completeChatGptAnswer(page);
	response.requestId = "123e4567-e89b-42d3-a456-426614174111";
	await page.getByLabel("Antwoord van ChatGPT").fill(JSON.stringify(response));
});

When(
	"I paste a cannot-complete ChatGPT answer with a long unbroken reason",
	async ({ page }) => {
		const stored = await page.evaluate(() =>
			sessionStorage.getItem("toen:chatgpt-request:v1"),
		);
		if (!stored) throw new Error("No active ChatGPT request");
		const active = JSON.parse(stored) as {
			formatVersion: number;
			requestId: string;
		};
		await page.getByLabel("Antwoord van ChatGPT").fill(
			JSON.stringify({
				formatVersion: active.formatVersion,
				requestId: active.requestId,
				status: "cannot-complete",
				reasons: ["oncontroleerbarebron".repeat(14)],
			}),
		);
	},
);

When("I check and use the ChatGPT answer", async ({ page }) => {
	await page
		.getByRole("button", { name: "Antwoord controleren en invullen" })
		.click();
});

When("I copy the ChatGPT repair instructions", async ({ page }) => {
	await page
		.getByRole("button", { name: "Herstelinstructies kopiëren" })
		.click();
});

When("I remake the ChatGPT instructions", async ({ page }) => {
	await page.getByRole("button", { name: "Instructies opnieuw maken" }).click();
});

When("I complete the story of an exact historical event", completeExactStory);

When(
	"I complete a story with the title {string}",
	async ({ page }, title: string) => {
		await completeExactStory({ page });
		await page.getByLabel("Titel").fill(title);
	},
);

When(
	"I complete a {string} historical story",
	async ({ page }, precision: string) => {
		await page.getByLabel("Titel").fill("Historische precisie");
		await page
			.getByLabel("Korte samenvatting")
			.fill("Een gebeurtenis met passende historische precisie.");
		await page
			.getByRole("textbox", { name: "Verhaal" })
			.fill("Het historische verhaal.");
		if (precision === "month CE") {
			await page
				.getByLabel("Hoe precies is de datum bekend?")
				.selectOption("month");
			await page.getByLabel("Maand").selectOption("11");
			await page.getByLabel("Jaar").fill("1918");
		} else if (precision === "year BCE") {
			await page
				.getByLabel("Hoe precies is de datum bekend?")
				.selectOption("year");
			await page.getByLabel("Tijdrekening").selectOption("bce");
			await page.getByLabel("Jaar").fill("753");
		} else {
			await page.getByLabel("Tijdrekening").selectOption("bce");
			await page.getByLabel("Dag").fill("15");
			await page.getByLabel("Maand").selectOption("3");
			await page.getByLabel("Jaar").fill("44");
		}
	},
);

When("I select story text for a link", async ({ page }) => {
	const editor = page.getByRole("textbox", { name: "Verhaal" });
	await editor.fill("Meer informatie");
	await editor.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
});

When("I choose link formatting", async ({ page }) => {
	await page.getByRole("button", { name: "Link" }).click();
});

When("I apply the link {string}", async ({ page }, url: string) => {
	const dialog = page.getByRole("dialog", { name: "Link toevoegen" });
	await dialog.getByLabel("URL").fill(url);
	await dialog.getByRole("button", { name: "Link toevoegen" }).click();
});

When("I cancel the link dialog", async ({ page }) => {
	await page.getByRole("button", { name: "Annuleren" }).click();
});

When("I close the link dialog with Escape", async ({ page }) => {
	await page.keyboard.press("Escape");
});

When("I continue to classification and sources", async ({ page }) => {
	await page
		.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
		.click();
});

When("I complete classification and two sources", async ({ page }) => {
	await completeMinimumClassification(page);
	await page.getByRole("button", { name: "Nog een bron toevoegen" }).click();
	await page.getByLabel("Titel van bron 2").fill("Tweede bron");
	await page.getByLabel("Uitgever van bron 2").fill("Museum");
	await page
		.getByLabel("URL van bron 2")
		.fill("https://example.org/tweede-bron");
});

When("I complete the minimum classification and source", async ({ page }) => {
	await completeMinimumClassification(page);
});

When("I create a vote activity with response cards", async ({ page }) => {
	await continueToActivity(page);
	await page.getByLabel("Een verhaal met klasactiviteit").check();
	await page
		.getByLabel("Hoe antwoorden leerlingen?")
		.selectOption("response-cards");
	await page.locator('[id="beat.question"]').fill("Welke keuze maak je?");
	await page.locator('[id="beat.choices.0.label"]').fill("Doorgaan");
	await page.locator('[id="beat.choices.1.label"]').fill("Stoppen");
	await page
		.locator('[id="beat.vocationalConnection"]')
		.fill("Vergelijk dit met veilig beslissen op de werkvloer.");
	for (const [index, stage] of [
		[0, { stimulus: "De situatie verandert onverwacht." }],
		[
			2,
			{
				title: "Eerste aanwijzing",
				evidence: "De eerste bron toont een risico.",
			},
		],
		[3, { prompt: "Welk detail weegt het zwaarst?" }],
		[
			4,
			{
				title: "Nieuwe aanwijzing",
				evidence: "De tweede bron toont een voordeel.",
			},
		],
		[5, { prompt: "Wat verandert er aan je keuze?" }],
		[
			6,
			{
				title: "Laatste aanwijzing",
				evidence: "Een extra detail maakt de afweging moeilijker.",
			},
		],
		[7, { prompt: "Welke onzekerheid blijft over?" }],
		[
			10,
			{
				title: "Wat gebeurde er?",
				feedback: "De historische keuze werd na afweging gemaakt.",
			},
		],
		[11, { bridge: "Welke afweging herken je in de rest van de les?" }],
	] as const) {
		for (const [field, value] of Object.entries(stage)) {
			await page.locator(`[id="beat.stages.${index}.${field}"]`).fill(value);
		}
	}
});

When("I choose article-only but cancel activity removal", async ({ page }) => {
	page.once("dialog", async (dialog) => {
		expect(dialog.message()).toBe(
			"Klasactiviteit verwijderen? De ingevulde activiteit gaat verloren.",
		);
		await dialog.dismiss();
	});
	await page.getByLabel("Alleen een achtergrondverhaal").click();
});

Then("the activity and central question remain", async ({ page }) => {
	await expect(page.getByLabel("Een verhaal met klasactiviteit")).toBeChecked();
	await expect(page.locator('[id="beat.question"]')).toHaveValue(
		"Welke keuze maak je?",
	);
});

When("I clear the central activity question", async ({ page }) => {
	await page.locator('[id="beat.question"]').fill("");
});

Then(
	"the activity question remains invalid and described in Dutch",
	async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: "Klasactiviteit", level: 2 }),
		).toBeVisible();
		const question = page.locator('[id="beat.question"]');
		await expect(question).toHaveValue("");
		await expect(question).toHaveAttribute("aria-invalid", "true");
		const descriptionId = await question.getAttribute("aria-describedby");
		expect(descriptionId).toBe("beat.question-error");
		await expect(page.locator('[id="beat.question-error"]')).toHaveText(
			/Fout: Vul de centrale vraag in\./,
		);
	},
);

When("I change the activity after preview", async ({ page }) => {
	await page.getByRole("button", { name: "Klasactiviteit wijzigen" }).click();
	await page.locator('[id="beat.question"]').fill("Een gewijzigde vraag?");
});

Then(
	"the activity needs a fresh preview before publication",
	async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: "Controleren & publiceren" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Voorbeeld bekijken" }),
		).toBeEnabled();
		await expect(page.getByRole("button", { name: "Publiceren" })).toHaveCount(
			0,
		);
	},
);

Then("authored teacher cues are available in review", async ({ page }) => {
	await page
		.getByText("Aanwijzingen voor de leerkracht", { exact: true })
		.click();
	await expect(
		page.getByText("Toon de situatie zonder het antwoord te verklappen.", {
			exact: true,
		}),
	).toBeVisible();
	await expect(
		page.getByText("Lees en denk eerst zelfstandig na.", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("20 seconden", { exact: true }).first(),
	).toBeVisible();
});

Then("I can open the exact classroom preview", async ({ page }) => {
	await page.getByRole("button", { name: "Klasvoorbeeld openen" }).click();
	await expect(
		page.getByRole("dialog", { name: "Klasactiviteit" }),
	).toBeVisible();
});

Then("the classroom preview shows response cards", async ({ page }) => {
	await expect(
		page.getByRole("dialog", { name: "Klasactiviteit" }),
	).toContainText("Antwoordkaarten");
});

Then(
	"the classroom preview toolbar does not cover the activity",
	async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		const toolbar = dialog.locator("[data-classroom-preview-toolbar]");
		const player = dialog.locator("[data-classroom-preview-player]");
		const layout = await Promise.all([
			toolbar.boundingBox(),
			player.boundingBox(),
		]);
		if (!layout[0] || !layout[1]) throw new Error("Missing preview layout");
		expect(layout[0].y + layout[0].height).toBeLessThanOrEqual(layout[1].y);
	},
);

Then(
	"classroom preview preparation remains reachable on a narrow screen",
	async ({ page }) => {
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		const player = dialog.locator("[data-classroom-preview-player]");
		await expect(
			dialog.getByRole("button", { name: "Start", exact: true }),
		).toBeVisible();
		const layout = await player.evaluate((element) => ({
			overflowY: getComputedStyle(element).overflowY,
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
		}));
		expect(layout.overflowY).toBe("auto");
		expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
	},
);

Then(
	"the vocational connection appears in the lesson bridge",
	async ({ page }) => {
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		await dialog.getByText("5 minuten", { exact: true }).click();
		await dialog.getByRole("button", { name: "Start", exact: true }).click();
		for (let step = 0; step < 6; step += 1) {
			await dialog.getByRole("button", { name: /Volgende|Toon meer/ }).click();
		}
		await expect(dialog).toContainText(
			"Vergelijk dit met veilig beslissen op de werkvloer.",
		);
	},
);

When("I add the new topic {string}", async ({ page }, topic: string) => {
	await page.getByLabel("Nieuw onderwerp").fill(topic);
	await page.getByRole("button", { name: "Onderwerp toevoegen" }).click();
});

When("I remove topic {string}", async ({ page }, topic: string) => {
	await page.getByRole("button", { name: topic }).click();
});

When(
	"I complete classification with an invalid source URL",
	async ({ page }) => {
		await page.getByLabel("Algemeen").check();
		await page.getByLabel("Nieuw onderwerp").fill("Politiek");
		await page.getByRole("button", { name: "Onderwerp toevoegen" }).click();
		await page.getByLabel("Titel van bron 1").fill("Bron");
		await page.getByLabel("Uitgever van bron 1").fill("Uitgever");
		await page.getByLabel("URL van bron 1").fill("geen-url");
	},
);

When("I request the reader preview", async ({ page }) => {
	await continueToActivity(page);
	await page.getByRole("button", { name: "Voorbeeld bekijken" }).click();
});

When("I continue the imported AI proposal to review", async ({ page }) => {
	if (
		await page
			.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
			.isVisible()
	) {
		await page
			.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
			.click();
	}
	await continueToActivity(page);
	await page.getByRole("button", { name: "Voorbeeld bekijken" }).click();
});

When(
	"I remove every current source relationship from the first AI claim",
	async ({ page }) => {
		const relationships = page.getByRole("group", {
			name: "Huidige bronnen voor bewering 1",
		});
		await expect(relationships).toBeVisible();
		for (const checkbox of await relationships.getByRole("checkbox").all()) {
			if (await checkbox.isChecked()) await checkbox.uncheck();
		}
	},
);

When("I choose and confirm every imported source", async ({ page }) => {
	for (const source of [
		"Werkelijke eerste brontitel",
		"Werkelijke tweede brontitel",
	]) {
		const link = page.getByRole("link", {
			name: `${source} openen in een nieuw tabblad`,
		});
		await link.evaluate((element) => {
			element.addEventListener("click", (event) => event.preventDefault(), {
				once: true,
			});
			(element as HTMLAnchorElement).click();
		});
		await page
			.getByRole("checkbox", {
				name: `Ik heb ${source} zelf geopend en gecontroleerd`,
			})
			.check();
	}
});

When("I confirm every current AI claim", async ({ page }) => {
	for (const checkbox of await page
		.getByRole("checkbox", {
			name: /Ik heb bewering \d+ met de gekoppelde bronnen gecontroleerd/,
		})
		.all()) {
		await checkbox.check();
	}
});

When("I edit the imported story after AI review", async ({ page }) => {
	await page.getByRole("button", { name: "Verhaal wijzigen" }).click();
	await page
		.getByLabel("Korte samenvatting")
		.fill("Deze historisch belangrijke bewering werd aangepast.");
});

When("I request the reader preview without waiting", async ({ page }) => {
	await continueToActivity(page);
	pendingPreviewResponse = page.waitForResponse((response) =>
		response.url().includes("/api/admin/events/preview"),
	);
	await page.getByRole("button", { name: "Voorbeeld bekijken" }).click();
});

When("I change the first source before preview returns", async ({ page }) => {
	await page
		.getByRole("button", { name: "Terug naar indeling & bronnen" })
		.click();
	await page.getByLabel("Titel van bron 1").fill("Gewijzigde bron");
});

When("I move source {int} up", async ({ page }, source: number) => {
	await page
		.getByRole("button", { name: `Bron ${source} omhoog verplaatsen` })
		.click();
});

When("I remove source {int}", async ({ page }, source: number) => {
	await page
		.getByRole("region", { name: `Bron ${source}` })
		.getByRole("button", { name: "Verwijderen" })
		.click();
});

When("I complete a valid event draft through review", async ({ page }) => {
	await completeExactStory({ page });
	await page
		.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
		.click();
	await completeMinimumClassification(page);
	await continueToActivity(page);
	await page.getByRole("button", { name: "Voorbeeld bekijken" }).click();
});

When("I choose to publish the event", async ({ page }) => {
	await page.getByRole("button", { name: "Publiceren" }).click();
});

When("I confirm publication", async ({ page }) => {
	await page.getByRole("button", { name: "Gebeurtenis publiceren" }).click();
});

When("I confirm publication without waiting", async ({ page }) => {
	await page.getByRole("button", { name: "Gebeurtenis publiceren" }).click();
});

When("I close the confirmation with Escape", async ({ page }) => {
	await page.keyboard.press("Escape");
});

When("I restore the local draft", async ({ page }) => {
	await page.getByRole("button", { name: "Concept herstellen" }).click();
});

When("I discard the local draft", async ({ page }) => {
	await page.getByRole("button", { name: "Concept verwijderen" }).click();
});

When("I enter the title {string}", async ({ page }, title: string) => {
	await page.getByLabel("Titel").fill(title);
});

When("I clear the title", async ({ page }) => {
	await page.getByLabel("Titel").fill("");
	await expect
		.poll(() =>
			page.evaluate(() =>
				[
					"toen:event-draft:v1",
					"toen:event-draft:v2",
					"toen:event-draft:v3",
				].every((key) => localStorage.getItem(key) === null),
			),
		)
		.toBe(true);
});

When("I wait until the concept is saved", async ({ page }) => {
	await expect(
		page.getByText("Concept opgeslagen op dit apparaat"),
	).toBeVisible();
});

When("the concept is still being saved", async ({ page }) => {
	await expect(page.getByText("Concept opslaan…")).toBeVisible();
});

When("I refresh the page", async ({ page }) => {
	await page.reload();
});

When("I continue without a title", async ({ page }) => {
	await page
		.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
		.click();
});

When("I retry the deployment", async ({ page }) => {
	await page
		.getByRole("button", { name: "Website-update opnieuw starten" })
		.click();
});

Then("no slug field is shown", async ({ page }) => {
	await expect(page.getByLabel("Slug")).toHaveCount(0);
});

Then("I see the rendered event {string}", async ({ page }, title: string) => {
	await expect(
		page.getByRole("heading", { level: 2, name: title }),
	).toBeVisible();
});

Then(
	"I see the source {string} in the review",
	async ({ page }, source: string) => {
		await expect(page.getByRole("link", { name: source })).toBeVisible();
	},
);

Then(
	"source {string} is not in the review",
	async ({ page }, source: string) => {
		await expect(
			page.getByRole("article").getByRole("link", { name: source }),
		).toHaveCount(0);
	},
);

Then(
	"source {string} appears before {string}",
	async ({ page }, first: string, second: string) => {
		await expect(page.getByRole("article").getByRole("link")).toHaveText([
			first,
			second,
		]);
	},
);

Then("I see the historical date {string}", async ({ page }, date: string) => {
	await expect(page.getByText(date, { exact: true })).toBeVisible();
});

Then("topic {string} is visibly selected", async ({ page }, topic: string) => {
	await expect(page.getByRole("button", { name: topic })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
});

Then("topic {string} is no longer shown", async ({ page }, topic: string) => {
	await expect(page.getByRole("button", { name: topic })).toHaveCount(0);
});

Then(
	"I see topic label {string} in the review",
	async ({ page }, topic: string) => {
		await expect(page.getByText(topic, { exact: true })).toBeVisible();
	},
);

Then(
	"the inferred event URL ends with {string}",
	async ({ page }, expectedPath: string) => {
		await expect(page.getByTestId("event-url")).toContainText(expectedPath);
	},
);

Then("an editor dialog asks for the link URL", async ({ page }) => {
	const dialog = page.getByRole("dialog", { name: "Link toevoegen" });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByLabel("URL")).toBeVisible();
});

Then(
	"the link error {string} is announced",
	async ({ page }, message: string) => {
		await expect(
			page.getByRole("alert").filter({ hasText: message }),
		).toHaveText(message);
	},
);

Then("the link URL has focus", async ({ page }) => {
	await expect(page.getByLabel("URL")).toBeFocused();
});

Then("the Link button has focus", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Link" })).toBeFocused();
});

Then("the rendered story links to {string}", async ({ page }, url: string) => {
	await expect(
		page.getByRole("article").getByRole("link", { name: "Meer informatie" }),
	).toHaveAttribute("href", url);
});

Then("canonical Markdown contains {string}", async ({ page }, text: string) => {
	await page.getByText("Technische details").click();
	await expect(page.getByTestId("markdown-preview")).toContainText(text);
});

Then(
	"a publication confirmation names {string}",
	async ({ page }, title: string) => {
		const dialog = page.getByRole("dialog", { name: "Publicatie bevestigen" });
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText(title);
	},
);

Then("the publication confirmation is closed", async ({ page }) => {
	await expect(
		page.getByRole("dialog", { name: "Publicatie bevestigen" }),
	).toHaveCount(0);
});

Then("safe cancellation has initial focus", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Nog even controleren" }),
	).toBeFocused();
});

Then("publication is still available and focused", async ({ page }) => {
	const button = page.getByRole("button", { name: "Publiceren" });
	await expect(button).toBeEnabled();
	await expect(button).toBeFocused();
});

Then("publication progress is announced", async ({ page }) => {
	await expect(
		page.getByRole("status").filter({ hasText: "Publiceren…" }),
	).toBeVisible();
});

Then("review navigation is disabled while publishing", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Verhaal wijzigen" }),
	).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Indeling & bronnen wijzigen" }),
	).toBeDisabled();
});

Then("the copy action has focus", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Instructies kopiëren" }),
	).toBeFocused();
});

Then(
	"I see that copied content goes to OpenAI and must not contain student data",
	async ({ page }) => {
		await expect(
			page.getByText(/naar OpenAI gestuurd.*geen namen.*leerlingen/i),
		).toBeVisible();
	},
);

Then(
	"the clipboard contains a source-aware request for {string}",
	async ({ page }, topic: string) => {
		const copied = await page.evaluate(
			() => (window as ClipboardTestWindow).copiedChatGptInstructions ?? "",
		);
		expect(copied).toContain(topic);
		expect(copied).toContain('"formatVersion": 1');
		expect(copied).toContain('"status": "complete"');
		expect(copied).toContain('"claims"');
		const requestId =
			/"requestId": "([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"/.exec(
				copied,
			)?.[1];
		expect(requestId).toBeTruthy();
		expect(
			await page.evaluate(() =>
				sessionStorage.getItem("toen:chatgpt-request:v1"),
			),
		).toBe(JSON.stringify({ formatVersion: 1, requestId }));
	},
);

Then("unrelated story fields were not copied", async ({ page }) => {
	const copied = await page.evaluate(
		() => (window as ClipboardTestWindow).copiedChatGptInstructions ?? "",
	);
	expect(copied).not.toContain("Bestaand privéconcept");
	expect(copied).not.toContain("/events/");
});

Then(
	"I can open ChatGPT without putting the instructions in the address",
	async ({ page }) => {
		const link = page.getByRole("link", {
			name: "Open ChatGPT in een nieuw tabblad",
		});
		await expect(link).toHaveAttribute("href", "https://chatgpt.com/");
		await expect(link).toHaveAttribute("target", "_blank");
		await expect(link).toHaveAttribute("rel", "noreferrer");
	},
);

Then(
	"the normal handoff does not show technical protocol terms",
	async ({ page }) => {
		await expect(
			page.getByText(/requestId|formatVersion|JSON|protocol/i),
		).toHaveCount(0);
	},
);

Then("the ChatGPT instructions must be made again", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Instructies maken" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Instructies kopiëren" }),
	).toHaveCount(0);
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem("toen:chatgpt-request:v1"),
		),
	).toBeNull();
});

Then(
	"the ChatGPT topic is invalid, described in Dutch, and focused",
	async ({ page }) => {
		const topic = page.getByLabel("Onderwerp of gebeurtenis");
		await expect(topic).toBeFocused();
		await expect(topic).toHaveAttribute("aria-invalid", "true");
		const descriptionId = await topic.getAttribute("aria-describedby");
		expect(descriptionId).toBeTruthy();
		await expect(page.locator(`[id="${descriptionId}"]`)).toHaveText(
			"Vul een onderwerp of gebeurtenis in.",
		);
	},
);

Then(
	"ChatGPT preference fields are hidden until requested",
	async ({ page }) => {
		await expect(page.getByLabel("Onderwerp of gebeurtenis")).toBeHidden();
		await expect(page.getByLabel("Titel")).toBeVisible();
	},
);

Then(
	"the imported story title is {string}",
	async ({ page }, title: string) => {
		await expect(page.getByLabel("Titel")).toHaveValue(title);
		await expect(page.getByLabel("Titel")).toBeFocused();
	},
);

Then("the imported answer remains visible", async ({ page }) => {
	await expect(page.getByLabel("Antwoord van ChatGPT")).toHaveValue(
		/"status":"complete"/,
	);
});

Then(
	"I see the imported article and exact classroom activity",
	async ({ page }) => {
		await expect(
			page.getByRole("article").getByRole("heading", {
				name: "AI-voorstel voor controle",
			}),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Klasvoorbeeld openen" }),
		).toBeVisible();
	},
);

Then(
	"the exact AI classroom preview remains scrollable on a narrow teacher screen",
	async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await page.getByRole("button", { name: "Klasvoorbeeld openen" }).click();
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		await dialog.getByText("12 minuten", { exact: true }).click();
		await dialog.getByRole("button", { name: "Start", exact: true }).click();
		const stageRegion = dialog.locator("[data-classroom-stage-region]");
		const layout = await stageRegion.evaluate((element) => ({
			overflowY: getComputedStyle(element).overflowY,
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}));
		expect(layout.overflowY).toBe("auto");
		expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
		expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
		await dialog.getByRole("button", { name: "Terug naar controle" }).click();
	},
);

Then(
	"I see AI claims, source relationships, and editorial warnings",
	async ({ page }) => {
		const review = page.getByRole("region", {
			name: "Controle van ChatGPT-voorstel",
		});
		await expect(
			review.getByText("Eén inhoudelijk belangrijke historische bewering."),
		).toBeVisible();
		await expect(
			review.getByRole("heading", {
				name: "Werkelijke eerste brontitel",
				exact: true,
			}),
		).toBeVisible();
		await expect(
			review.getByText("Twijfel gemeld door ChatGPT:", { exact: false }),
		).toBeVisible();
		await expect(
			review.getByText(
				"Een werkende link bewijst niet dat de bron de bewering ondersteunt.",
			),
		).toBeVisible();
		await expect(
			review.getByText(/koppelen als huidige bron bij bewering 1/).first(),
		).toBeVisible();
		await expect(review).not.toContainText("ondersteunt bewering 1");
		await expect(
			review.getByText("Twijfel gemeld door ChatGPT:", { exact: false }),
		).toBeVisible();
		await expect(review).toContainText("onzekerheid".repeat(45));
	},
);

Then(
	"source link choice is not described as proof or reachability",
	async ({ page }) => {
		const review = page.getByRole("region", {
			name: "Controle van ChatGPT-voorstel",
		});
		await expect(review).not.toContainText("bereikbaar");
		await expect(review).not.toContainText("bewezen");
		await expect(review).toContainText("kies je alleen de bronlink");
	},
);

Then(
	"AI source confirmations are unchecked before link choice",
	async ({ page }) => {
		for (const checkbox of await page
			.getByRole("checkbox", { name: /zelf geopend en gecontroleerd/ })
			.all()) {
			await expect(checkbox).toBeDisabled();
			await expect(checkbox).not.toBeChecked();
			await expect(checkbox).toHaveAttribute(
				"aria-describedby",
				/-confirm-hint$/,
			);
		}
		await expect(
			page.getByRole("checkbox", {
				name: "Ik heb bewering 1 met de gekoppelde bronnen gecontroleerd",
			}),
		).toHaveAttribute("aria-describedby", "claim-1-confirm-hint");
	},
);

Then(
	"the AI draft review reflows without horizontal page scrolling",
	async ({ page }) => {
		const layout = await page.evaluate(() => ({
			overflow: document.documentElement.scrollWidth - window.innerWidth,
			offenders: [...document.querySelectorAll<HTMLElement>("body *")]
				.filter(
					(element) =>
						element.getBoundingClientRect().right > window.innerWidth + 1,
				)
				.slice(0, 5)
				.map((element) => ({
					tag: element.tagName,
					className: element.className,
					text: element.textContent?.slice(0, 80),
					right: element.getBoundingClientRect().right,
				})),
		}));
		expect(
			layout.overflow,
			JSON.stringify(layout.offenders),
		).toBeLessThanOrEqual(1);
	},
);

Then(
	"publication is unavailable until the AI review is complete",
	async ({ page }) => {
		const publish = page.getByRole("button", { name: "Publiceren" });
		await expect(publish).toBeDisabled();
		await expect(publish).toHaveAttribute(
			"aria-describedby",
			"ai-review-status",
		);
		await expect(
			page.getByText(
				"Publiceren kan pas na de volledige inhoudelijke controle.",
			),
		).toBeVisible();
	},
);

Then("I see the restored AI claim", async ({ page }) => {
	await expect(
		page
			.getByRole("region", { name: "Controle van ChatGPT-voorstel" })
			.getByText("Eén inhoudelijk belangrijke historische bewering."),
	).toBeVisible();
});

Then("the first AI claim reports missing evidence", async ({ page }) => {
	await expect(
		page.getByRole("alert").filter({
			hasText: "Koppel minstens één huidige bron aan deze bewering.",
		}),
	).toBeVisible();
});

Then("publication is available after AI review", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Publiceren" })).toBeEnabled();
	await expect(
		page.getByText("Alle bronnen en beweringen zijn inhoudelijk nagekeken."),
	).toBeVisible();
});

Then("the changed AI proposal warning is visible", async ({ page }) => {
	await expect(
		page.getByText(
			"Je wijzigde het voorstel. Controleer de beweringen opnieuw in de huidige versie.",
		),
	).toBeVisible();
});

Then("every AI claim needs review again", async ({ page }) => {
	for (const checkbox of await page
		.getByRole("checkbox", {
			name: /Ik heb bewering \d+ met de gekoppelde bronnen gecontroleerd/,
		})
		.all()) {
		await expect(checkbox).not.toBeChecked();
	}
});

Then("the imported sources and activity are editable", async ({ page }) => {
	await page
		.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
		.click();
	const sourceTitle = page.getByLabel("Titel van bron 1");
	await expect(sourceTitle).toHaveValue("Werkelijke eerste brontitel");
	await sourceTitle.fill("Aangepaste eerste brontitel");
	await expect(sourceTitle).toHaveValue("Aangepaste eerste brontitel");
	await page
		.getByRole("button", { name: "Ga verder naar klasactiviteit" })
		.click();
	const question = page.locator('[id="beat.question"]');
	await expect(question).toHaveValue("Eén centrale historische vraag?");
	await question.fill("Aangepaste centrale historische vraag?");
	await expect(question).toHaveValue("Aangepaste centrale historische vraag?");
	await expect(page.getByLabel("Hoe antwoorden leerlingen?")).toHaveValue(
		"response-cards",
	);
});

Then("the active ChatGPT request was consumed", async ({ page }) => {
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem("toen:chatgpt-request:v1"),
		),
	).toBeNull();
});

Then("publication still requires a server preview", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Publiceren" })).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Voorbeeld bekijken" }),
	).toBeVisible();
});

Then("my story title remains {string}", async ({ page }, title: string) => {
	await expect(page.getByLabel("Titel")).toHaveValue(title);
});

Then("the pasted ChatGPT answer remains visible", async ({ page }) => {
	await expect(page.getByLabel("Antwoord van ChatGPT")).not.toHaveValue("");
});

Then("a plain Dutch import error has focus", async ({ page }) => {
	const error = page.getByRole("alert").filter({
		hasText: "Het antwoord is niet volledig of niet leesbaar.",
	});
	await expect(error).toBeVisible();
	await expect(error).toBeFocused();
});

Then("the old import error and repair action are cleared", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Herstelinstructies kopiëren" }),
	).toHaveCount(0);
	await expect(
		page.getByRole("alert").filter({
			hasText: "Het antwoord is niet volledig of niet leesbaar.",
		}),
	).toHaveCount(0);
});

Then(
	"the clipboard contains repair instructions without the hostile paste",
	async ({ page }) => {
		const copied = await page.evaluate(
			() => (window as ClipboardTestWindow).copiedChatGptInstructions ?? "",
		);
		expect(copied).toContain("Herstel je vorige antwoord");
		expect(copied).not.toContain("<script>kapot</script>");
	},
);

Then("I see that ChatGPT import needs an empty draft", async ({ page }) => {
	const alert = page.getByRole("alert").filter({
		hasText: "Dit voorstel kan alleen in een leeg concept worden ingevuld.",
	});
	await expect(alert).toBeVisible();
	await expect(alert).toBeFocused();
});

Then("the saved draft can still be restored", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Onvoltooid concept gevonden" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Concept herstellen" }),
	).toBeEnabled();
});

Then(
	"I see that the ChatGPT answer belongs to older instructions",
	async ({ page }) => {
		await expect(
			page.getByRole("alert").filter({
				hasText: "Dit antwoord hoort niet bij de laatst gemaakte instructies.",
			}),
		).toBeVisible();
	},
);

Then("I see why ChatGPT could not make a safe proposal", async ({ page }) => {
	const alert = page.getByRole("alert").filter({
		hasText: "ChatGPT kon geen veilig volledig voorstel maken.",
	});
	await expect(alert.locator("li")).toHaveText(
		"oncontroleerbarebron".repeat(14),
	);
	await expect(alert).toBeFocused();
});

Then("the import feedback reflows on a narrow screen", async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 568 });
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	expect(overflow).toBeLessThanOrEqual(1);
});

Then("the story remains empty", async ({ page }) => {
	await expect(page.getByLabel("Titel")).toHaveValue("");
});

Then("selectable manual repair instructions are focused", async ({ page }) => {
	const instructions = page.getByLabel(
		"Herstelinstructies om zelf te kopiëren",
	);
	await expect(instructions).toBeVisible();
	await expect(instructions).toBeFocused();
	await expect(instructions).toHaveAttribute("readonly", "");
});

Then(
	"the manual repair instructions do not repeat {string}",
	async ({ page }, hostile: string) => {
		const instructions = await page
			.getByLabel("Herstelinstructies om zelf te kopiëren")
			.inputValue();
		expect(instructions).toContain("Herstel je vorige antwoord");
		expect(instructions).not.toContain(hostile);
	},
);

Then("selectable manual instructions are focused", async ({ page }) => {
	const instructions = page.getByLabel("Instructies om zelf te kopiëren");
	await expect(instructions).toBeVisible();
	await expect(instructions).toBeFocused();
	await expect(instructions).toHaveAttribute("readonly", "");
});

Then(
	"the manual instructions contain {string}",
	async ({ page }, topic: string) => {
		const instructions = await page
			.getByLabel("Instructies om zelf te kopiëren")
			.inputValue();
		expect(instructions).toContain(topic);
	},
);

Then("I see that nothing was published", async ({ page }) => {
	await expect(page.getByText("Niet gepubliceerd")).toBeVisible();
});

Then("I see that the preview could not be made", async ({ page }) => {
	await expect(
		page.getByRole("alert").filter({
			hasText: "Het voorbeeld kon niet worden gemaakt. Probeer opnieuw.",
		}),
	).toBeVisible();
});

Then("no publication action is available", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Publiceren" })).toHaveCount(0);
});

Then("the AI review provenance remains stored", async ({ page }) => {
	await expect
		.poll(async () =>
			page.evaluate(() => {
				const value = localStorage.getItem("toen:event-draft:v3");
				if (!value) return false;
				const stored = JSON.parse(value) as {
					version?: number;
					aiReview?: { claims?: unknown[] } | null;
				};
				return (
					stored.version === 3 &&
					Boolean(stored.aiReview) &&
					stored.aiReview?.claims?.length === 1
				);
			}),
		)
		.toBe(true);
});

Then("the stale draft does not reach review", async ({ page }) => {
	if (!pendingPreviewResponse)
		throw new Error("No preview response is pending");
	await pendingPreviewResponse;
	pendingPreviewResponse = null;
	await expect(
		page.getByRole("heading", { name: "Controleren & publiceren" }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Ga verder naar klasactiviteit" }),
	).toBeEnabled();
});

Then("all local draft versions are cleared", async ({ page }) => {
	await expect
		.poll(() =>
			page.evaluate(() =>
				[
					"toen:event-draft:v1",
					"toen:event-draft:v2",
					"toen:event-draft:v3",
				].every((key) => localStorage.getItem(key) === null),
			),
		)
		.toBe(true);
});

Then("no AI review is shown for the manual draft", async ({ page }) => {
	await expect(
		page.getByRole("region", { name: "Controle van ChatGPT-voorstel" }),
	).toHaveCount(0);
});

Then("the created commit is shown", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Opgeslagen versie bekijken" }),
	).toHaveAttribute(
		"href",
		"https://github.com/example/toen-content/commit/commit-sha",
	);
});

Then(
	"I see that the website update started without claiming the event is live",
	async ({ page }) => {
		await expect(
			page.getByText("Inhoud opgeslagen", { exact: true }),
		).toBeVisible();
		await expect(
			page.getByText("Gebeurtenis gepubliceerd", { exact: true }),
		).toHaveCount(0);
		await expect(page.getByText("De website-update is gestart.")).toBeVisible();
	},
);

Then("the same draft cannot be published again", async ({ page }) => {
	await expect(page.getByRole("button", { name: "Publiceren" })).toHaveCount(0);
});

Then("the restore notice is closed", assertNoRestoreNotice);
Then("no stale restore notice is shown", assertNoRestoreNotice);

Then("the title field contains {string}", async ({ page }, title: string) => {
	await expect(page.getByLabel("Titel")).toHaveValue(title);
});

Then("the story editor contains {string}", async ({ page }, story: string) => {
	await expect(page.getByRole("textbox", { name: "Verhaal" })).toContainText(
		story,
	);
});

Then("I resume at classification and sources", async ({ page }) => {
	await expect(
		page.getByRole("heading", { level: 2, name: "Indeling & bronnen" }),
	).toBeVisible();
});

Then("the page warns before leaving", async ({ page }) => {
	const warned = await page.evaluate(() => {
		const event = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(event);
		return event.defaultPrevented;
	});
	expect(warned).toBe(true);
});

Then("I see the field error {string}", async ({ page }, message: string) => {
	await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
});

Then("the title field is marked invalid", async ({ page }) => {
	await expect(page.getByLabel("Titel")).toHaveAttribute(
		"aria-invalid",
		"true",
	);
});

Then(
	"the source URL field is marked invalid and described by its error",
	async ({ page }) => {
		const field = page.getByLabel("URL van bron 1");
		await expect(field).toHaveAttribute("aria-invalid", "true");
		const descriptionId = await field.getAttribute("aria-describedby");
		expect(descriptionId).toBeTruthy();
		await expect(page.locator(`[id="${descriptionId}"]`)).toBeVisible();
	},
);

Then("stage heading {string} has focus", async ({ page }, title: string) => {
	await expect(
		page.getByRole("heading", { level: 2, name: title }),
	).toBeFocused();
});

Then("I remain on the story stage", async ({ page }) => {
	await expect(
		page.getByRole("heading", { level: 2, name: "Verhaal" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "Indeling & bronnen" }),
	).toHaveCount(0);
});

Then(
	"I see that the commit was saved but deployment needs a retry",
	async ({ page }) => {
		await expect(page.getByText("Inhoud opgeslagen")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Website-update opnieuw starten" }),
		).toBeEnabled();
	},
);

async function assertNoRestoreNotice({
	page,
}: {
	page: import("@playwright/test").Page;
}) {
	await expect(
		page.getByRole("heading", { name: "Onvoltooid concept gevonden" }),
	).toHaveCount(0);
}

async function installStoredDraft(
	page: import("@playwright/test").Page,
	step: 1 | 3,
) {
	await page.addInitScript((storedStep) => {
		const storageKey = "toen:event-draft:v1";
		if (localStorage.getItem(storageKey)) return;
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				version: 1,
				step: storedStep,
				draft: {
					title: "Bewaard verhaal",
					precision: "year",
					era: "ce",
					exactDate: "",
					year: "1920",
					month: "",
					day: "",
					summary: "Een bewaarde samenvatting.",
					body: "Een bewaard verhaal.",
					profiles: ["algemeen"],
					topics: ["politiek"],
					sources: [
						{
							title: "Bron",
							publisher: "Uitgever",
							url: "https://example.org",
						},
					],
				},
			}),
		);
	}, step);
}

async function completeExactStory({
	page,
}: {
	page: import("@playwright/test").Page;
}) {
	await page.getByLabel("Titel").fill("Constantinopel valt");
	await page.getByLabel("Hoe precies is de datum bekend?").selectOption("day");
	await page.getByLabel("Tijdrekening").selectOption("ce");
	await page.getByLabel("Exacte datum").fill("1453-05-29");
	await page
		.getByLabel("Korte samenvatting")
		.fill("Ottomaanse troepen nemen Constantinopel in.");
	await page
		.getByRole("textbox", { name: "Verhaal" })
		.fill("De stad werd na een beleg ingenomen.");
}

async function continueToActivity(page: import("@playwright/test").Page) {
	const continueButton = page.getByRole("button", {
		name: "Ga verder naar klasactiviteit",
	});
	if (await continueButton.isVisible()) await continueButton.click();
}

async function completeMinimumClassification(
	page: import("@playwright/test").Page,
) {
	await page.getByLabel("Algemeen").check();
	await page.getByLabel("Nieuw onderwerp").fill("Politiek");
	await page.getByRole("button", { name: "Onderwerp toevoegen" }).click();
	await page.getByLabel("Titel van bron 1").fill("Fall of Constantinople");
	await page.getByLabel("Uitgever van bron 1").fill("Encyclopaedia Britannica");
	await page
		.getByLabel("URL van bron 1")
		.fill("https://www.britannica.com/event/Fall-of-Constantinople-1453");
}

async function completeChatGptAnswer(
	page: import("@playwright/test").Page,
): Promise<{ requestId: string; draft: Record<string, unknown> }> {
	const prompt = await page.evaluate(
		() => (window as ClipboardTestWindow).copiedChatGptInstructions ?? "",
	);
	const match =
		/Gebruik bij succes exact deze envelop en vul alle voorbeeldtekst inhoudelijk in:\n([\s\S]*?)\n\nREGELS VOOR HET OBJECT/.exec(
			prompt,
		);
	if (!match)
		throw new Error("Complete ChatGPT answer missing from instructions");
	return JSON.parse(match[1]) as {
		requestId: string;
		draft: Record<string, unknown>;
	};
}

function publishResult(
	status: "committed-and-triggered" | "committed-trigger-failed",
	change: "created" | "unchanged",
) {
	return {
		status,
		change,
		...previewResult(),
		commitSha: "commit-sha",
		commitUrl: "https://github.com/example/toen-content/commit/commit-sha",
	};
}

function previewResult() {
	return {
		path: "content/events/constantinopel-valt-1453.md",
		markdown:
			"---\ntitle: Constantinopel valt\n---\n\nDe stad werd ingenomen.\n",
		event: {
			slug: "constantinopel-valt-1453",
			title: "Constantinopel valt",
			date: { year: 1453, era: "ce", precision: "day", month: 5, day: 29 },
			summary: "Ottomaanse troepen nemen Constantinopel in.",
			topics: ["politiek"],
			profiles: ["algemeen"],
			sources: [
				{
					title: "Fall of Constantinople",
					publisher: "Encyclopaedia Britannica",
					url: "https://www.britannica.com/event/Fall-of-Constantinople-1453",
				},
			],
			body: "De stad werd ingenomen.",
		},
	};
}
