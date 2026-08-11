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
	await page.getByLabel("Titel").fill("Bestaand privéconcept");
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
			page.evaluate(() => localStorage.getItem("toen:event-draft:v2")),
		)
		.toBeNull();
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
