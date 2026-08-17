import { readFileSync } from "node:fs";
import { expect } from "@playwright/test";
import { createBdd, test } from "playwright-bdd";

const { Given, Then, When } = createBdd(test);
let pendingPreviewResponse: Promise<unknown> | null = null;

type ClipboardTestWindow = Window & {
	calendarPickerOpened?: boolean;
	copiedChatGptInstructions?: string;
};

const ironCurtainResponse = readFileSync(
	"tests/fixtures/chatgpt-iron-curtain-response.txt",
	"utf8",
);
const cleopatraResponseTemplate = readFileSync(
	"tests/fixtures/cleopatra-response.template.txt",
	"utf8",
);

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

Given("ChatGPT request IDs use the actual response ID", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(crypto, "randomUUID", {
			configurable: true,
			value: () => "ede971ad-4a34-4637-abcd-5d689b22d7f7",
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

Given(
	"the admin viewport is {int} by {int}",
	async ({ page }, width: number, height: number) => {
		await page.setViewportSize({ width, height });
	},
);

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
		const topicField = page.getByLabel("Onderwerp of gebeurtenis");
		if (!(await topicField.isVisible())) {
			await page.getByRole("button", { name: "Voorkeuren wijzigen" }).click();
		}
		await topicField.fill(topic);
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

When("I paste the actual Iron Curtain ChatGPT answer", async ({ page }) => {
	await page.getByLabel("Antwoord van ChatGPT").fill(ironCurtainResponse);
});

When("I paste the request-bound Cleopatra response", async ({ page }) => {
	const stored = await page.evaluate(() =>
		sessionStorage.getItem("toen:chatgpt-request:v1"),
	);
	if (!stored) throw new Error("No active ChatGPT request");
	const active = JSON.parse(stored) as { requestId: string };
	await page
		.getByLabel("Antwoord van ChatGPT")
		.fill(
			cleopatraResponseTemplate.replace("{{REQUEST_ID}}", active.requestId),
		);
});

When(
	"I paste the malformed ChatGPT answer {string}",
	async ({ page }, value: string) => {
		await openChatGptResponseStep(page);
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
		await openChatGptResponseStep(page);
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

When("I choose an exact date with the calendar button", async ({ page }) => {
	await page.getByLabel("Hoe precies is de datum bekend?").selectOption("day");
	await page.getByLabel("Tijdrekening").selectOption("ce");
	await page.evaluate(() => {
		Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
			configurable: true,
			value() {
				(window as ClipboardTestWindow).calendarPickerOpened = true;
			},
		});
	});
	await page.getByRole("button", { name: "Kalender openen" }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as ClipboardTestWindow).calendarPickerOpened ?? false,
			),
		)
		.toBe(true);
	await page.locator("[data-calendar-input]").evaluate((input) => {
		const dateInput = input as HTMLInputElement;
		const setValue = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		setValue?.call(dateInput, "1453-05-29");
		dateInput.dispatchEvent(new Event("input", { bubbles: true }));
		dateInput.dispatchEvent(new Event("change", { bubbles: true }));
	});
});

Then('the exact date field contains "29.05.1453"', async ({ page }) => {
	await expect(page.getByLabel("Exacte datum", { exact: true })).toHaveValue(
		"29.05.1453",
	);
});

Then("the calendar button is icon-only and accessible", async ({ page }) => {
	const calendarButton = page.getByRole("button", { name: "Kalender openen" });
	await expect(calendarButton).toHaveAttribute(
		"title",
		"Datum in kalender kiezen",
	);
	await expect(calendarButton).not.toContainText("Kalender openen");
	await expect(calendarButton.locator("svg")).toHaveAttribute(
		"aria-hidden",
		"true",
	);
});

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

When(
	"I manually author the approximate BCE dinosaur event with an activity",
	async ({ page }) => {
		await page
			.getByLabel("Titel")
			.fill("Het einde van de niet-vliegende dinosauriërs");
		await page
			.getByLabel("Hoe precies is de datum bekend?")
			.selectOption("approximate");
		await page.getByLabel("Tijdrekening").selectOption("bce");
		await page.getByLabel("Jaar").fill("66000000");
		await page
			.getByLabel("Korte samenvatting")
			.fill(
				"Ongeveer 66 miljoen jaar geleden droeg een grote inslag bij aan een massa-uitsterving waarbij alle niet-vliegende dinosauriërs verdwenen.",
			);
		await page
			.getByRole("textbox", { name: "Verhaal" })
			.fill(
				"Aan het einde van het Krijt sloeg een grote planetoïde in bij het huidige Yucatán. Stof en aerosolen beperkten zonlicht en verstoorden klimaat en voedselketens. Alle niet-vliegende dinosauriërs stierven uit, terwijl vogels als dinosauriërlijn overleefden.",
			);
		await page
			.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
			.click();
		await page.getByLabel("Algemeen").check();
		await page.getByRole("button", { name: "Wetenschap" }).click();
		await page.getByLabel("Nieuw onderwerp").fill("Dinosauriërs");
		await page.getByRole("button", { name: "Onderwerp toevoegen" }).click();
		await page
			.getByLabel("Titel van bron 1")
			.fill("What killed the dinosaurs?");
		await page.getByLabel("Uitgever van bron 1").fill("Natural History Museum");
		await page
			.getByLabel("URL van bron 1")
			.fill("https://www.nhm.ac.uk/discover/dinosaur-extinction.html");
		await page.getByRole("button", { name: "Nog een bron toevoegen" }).click();
		await page
			.getByLabel("Titel van bron 2")
			.fill("Sediment Swirls Off the Yucatán");
		await page.getByLabel("Uitgever van bron 2").fill("NASA Science");
		await page
			.getByLabel("URL van bron 2")
			.fill(
				"https://science.nasa.gov/earth/earth-observatory/sediment-swirls-off-the-yucatan-149114/",
			);
		await page
			.getByRole("button", { name: "Ga verder naar klasactiviteit" })
			.click();
		await page.getByLabel("Een verhaal met klasactiviteit").check();
		await fillManualDinosaurBeat(page);
		await page.getByRole("button", { name: "Voorbeeld bekijken" }).click();
	},
);

When("I edit and reload the dinosaur draft", async ({ page }) => {
	await page.getByRole("button", { name: "Verhaal wijzigen" }).click();
	await page
		.getByLabel("Titel")
		.fill("Het einde van de niet-vliegende dinosauriërs — herzien");
	await expect(
		page.getByText("Concept opgeslagen op dit apparaat"),
	).toBeVisible();
	await page.reload();
});

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

When("I try to continue to the activity", async ({ page }) => {
	await page
		.getByRole("button", { name: "Ga verder naar klasactiviteit" })
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

When("I begin a classroom activity", async ({ page }) => {
	await continueToActivity(page);
	await page.getByLabel("Een verhaal met klasactiviteit").check();
});

When(
	"I enter the central activity question {string}",
	async ({ page }, question: string) => {
		await page.locator('[id="beat.question"]').fill(question);
	},
);

When("I go to the next activity part", async ({ page }) => {
	await page.getByRole("button", { name: "Volgende onderdeel" }).click();
});

When("I go to the previous activity part", async ({ page }) => {
	await page.getByRole("button", { name: "Vorig onderdeel" }).click();
});

When(
	"I clear the projected text in activity part {string}",
	async ({ page }, part: string) => {
		if (part !== "Startvraag")
			throw new Error(`Unknown activity part: ${part}`);
		await selectActivityPart(page, 1);
		await page.locator('[id="beat.stages.0.stimulus"]').fill("");
	},
);

When("I create a vote activity with response cards", async ({ page }) => {
	await continueToActivity(page);
	await page.getByLabel("Een verhaal met klasactiviteit").check();
	await selectActivityPart(page, 0);
	await page
		.getByLabel("Hoe antwoorden leerlingen?")
		.selectOption("response-cards");
	await page.locator('[id="beat.question"]').fill("Welke keuze maak je?");
	await page.locator('[id="beat.choices.0.label"]').fill("Doorgaan");
	await page.locator('[id="beat.choices.1.label"]').fill("Stoppen");
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
		await selectActivityPart(page, index + 1);
		for (const [field, value] of Object.entries(stage)) {
			await page.locator(`[id="beat.stages.${index}.${field}"]`).fill(value);
		}
	}
	await selectActivityPart(page, 13);
	await page
		.locator('[id="beat.vocationalConnection"]')
		.fill("Vergelijk dit met veilig beslissen op de werkvloer.");
	await page
		.locator('[id="beat.sensitivityNotes.0"]')
		.fill("Aandachtspunt voor gevoelige inhoud.");
	await selectActivityPart(page, 0);
});

When("I confirm article-only activity removal", async ({ page }) => {
	page.once("dialog", async (dialog) => dialog.accept());
	await page.getByLabel("Alleen een achtergrondverhaal").click();
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

Then(
	"the ChatGPT grouping is quiet while its controls remain bounded",
	async ({ page }) => {
		const grouping = page.locator("[data-passive-group='chatgpt']");
		await expect(grouping).toBeVisible();
		await expect(grouping).toHaveCSS("border-top-width", "0px");
		await expect(grouping).toHaveCSS(
			"background-color",
			"rgba(255, 255, 255, 0.38)",
		);
		await page
			.locator("summary")
			.filter({ hasText: "Begin met hulp van ChatGPT" })
			.click();
		await expect(page.getByLabel("Onderwerp of gebeurtenis")).toHaveCSS(
			"border-top-width",
			"1px",
		);
	},
);

Then(
	"the active activity group is quiet while its controls remain bounded",
	async ({ page }) => {
		const grouping = page.locator("[data-passive-group='activity-part']");
		await expect(grouping).toBeVisible();
		await expect(grouping).toHaveCSS("border-top-width", "0px");
		await expect(grouping).toHaveCSS(
			"background-color",
			"rgba(255, 255, 255, 0.38)",
		);
		await expect(page.locator('[id="beat.question"]')).toHaveCSS(
			"border-top-width",
			"1px",
		);
	},
);

Then(
	"the activity part change uses restrained continuity",
	async ({ page }) => {
		const part = page.locator("[data-passive-group='activity-part']");
		await expect(part).toHaveCSS("animation-duration", "0.24s");
		await expect(part).toHaveCSS("animation-name", "authoring-part-enter");
	},
);

Then("the guided activity editor shows one active part", async ({ page }) => {
	await expect(page.getByRole("heading", { name: "Basis" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Startvraag" })).toHaveCount(
		0,
	);
	await expect(
		page.getByRole("navigation", { name: "Onderdelen van de klasactiviteit" }),
	).toBeVisible();
});

Then("the guided activity editor fits the viewport", async ({ page }) => {
	const layout = await page
		.getByRole("region", { name: "Basis" })
		.evaluate((region) => ({
			left: region.getBoundingClientRect().left,
			right: region.getBoundingClientRect().right,
			documentWidth: document.documentElement.scrollWidth,
			viewportWidth: window.innerWidth,
		}));
	expect(layout.left).toBeGreaterThanOrEqual(0);
	expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
	expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

Then(
	"activity part heading {string} has focus",
	async ({ page }, heading: string) => {
		await expect(page.getByRole("heading", { name: heading })).toBeFocused();
	},
);

Then(
	"the central activity question remains {string}",
	async ({ page }, question: string) => {
		await expect(page.locator('[id="beat.question"]')).toHaveValue(question);
	},
);

Then("the activity preview action remains available", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Voorbeeld bekijken" }),
	).toBeVisible();
});

Then("activity field {string} is focused", async ({ page }, field: string) => {
	await expect(page.locator(`[id="${field}"]`)).toBeFocused();
});

Then(
	"activity part heading {string} is visible",
	async ({ page }, heading: string) => {
		await expect(page.getByRole("heading", { name: heading })).toBeVisible();
	},
);

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

Then(
	"the classroom correction action is inside the classroom review",
	async ({ page }) => {
		await expect(
			page
				.getByRole("region", { name: "Klasactiviteit" })
				.getByRole("button", { name: "Klasactiviteit wijzigen" }),
		).toBeVisible();
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

Then(
	"trusted image attribution remains usable in classroom preview",
	async ({ page }) => {
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		const sourceLink = dialog.getByRole("link", { name: "Beeldbron" });
		await expect(sourceLink).toHaveAttribute("target", "_blank");
		await expect(sourceLink).toHaveAttribute("rel", "noreferrer");
		await page
			.context()
			.route("https://commons.wikimedia.org/**", (route) =>
				route.fulfill({ status: 200, body: "beeldbron" }),
			);
		const popupPromise = page.waitForEvent("popup");
		await sourceLink.click();
		const popup = await popupPromise;
		await expect(popup).toHaveURL(/commons\.wikimedia\.org/);
		await popup.close();
		await expect(dialog).toBeVisible();
	},
);

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
	"classroom preview preparation shows the response method and sensitivity guidance",
	async ({ page }) => {
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		await expect(dialog.locator("[data-classroom-setup]")).toContainText(
			"Antwoordvorm: Antwoordkaarten",
		);
		await expect(dialog.locator("[data-classroom-sensitivity]")).toContainText(
			"Aandachtspunt voor gevoelige inhoud",
		);
	},
);

Then(
	"classroom preview preparation fits on a narrow screen",
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
		expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
	},
);

Then(
	"the vocational connection appears in the lesson bridge",
	async ({ page }) => {
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		await dialog.getByText("5 min", { exact: true }).click();
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

When("I go to the next incomplete AI review item", async ({ page }) => {
	await page.getByRole("button", { name: "Volgende open controle" }).click();
});

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

Then(
	"story and source correction actions border the article preview",
	async ({ page }) => {
		await expect(page.locator('[data-review-edit="story"]')).toBeVisible();
		await expect(page.locator('[data-review-edit="sources"]')).toBeVisible();
		const positions = await page.evaluate(() => {
			const article = document.querySelector("article");
			const story = document.querySelector('[data-review-edit="story"]');
			const sources = document.querySelector('[data-review-edit="sources"]');
			if (!article || !story || !sources)
				throw new Error("Missing review actions");
			return {
				articleTop: article.getBoundingClientRect().top,
				articleBottom: article.getBoundingClientRect().bottom,
				storyTop: story.getBoundingClientRect().top,
				sourcesTop: sources.getBoundingClientRect().top,
			};
		});
		expect(positions.storyTop).toBeLessThan(positions.articleTop);
		expect(positions.sourcesTop).toBeGreaterThan(positions.articleBottom);
	},
);

Then("the publish action is in the review action area", async ({ page }) => {
	await expect(
		page
			.locator("[data-review-actions]")
			.getByRole("button", { name: "Publiceren" }),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Publiceren" })).toHaveCount(1);
});

Then("contextual review actions fit the viewport", async ({ page }) => {
	const geometry = await page
		.locator("[data-review-actions]")
		.evaluate((element) => ({
			left: element.getBoundingClientRect().left,
			right: element.getBoundingClientRect().right,
			documentWidth: document.documentElement.scrollWidth,
			viewportWidth: window.innerWidth,
		}));
	expect(geometry.left).toBeGreaterThanOrEqual(0);
	expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
	expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
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
		await expect(
			page.getByRole("article").getByRole("complementary").getByRole("link"),
		).toHaveText([first, second]);
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

Then(
	"publication progress is shown in the review action area",
	async ({ page }) => {
		await expect(
			page
				.locator("[data-review-actions]")
				.getByRole("status")
				.filter({ hasText: "Publiceren…" }),
		).toBeVisible();
	},
);

Then(
	"the publication result has focus in the review action area",
	async ({ page }) => {
		await expect(
			page.locator("[data-review-actions] [data-publish-status]"),
		).toBeFocused();
	},
);

Then("AI review controls are disabled while publishing", async ({ page }) => {
	for (const checkbox of await page
		.getByRole("region", { name: "Controle van ChatGPT-voorstel" })
		.getByRole("checkbox")
		.all()) {
		await expect(checkbox).toBeDisabled();
	}
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
	"ChatGPT handoff step {string} is current",
	async ({ page }, step: string) => {
		await expect(
			page.getByRole("heading", { name: new RegExp(`^\\d+\\. ${step}$`) }),
		).toHaveAttribute("aria-current", "step");
	},
);

Then("future ChatGPT response controls are unavailable", async ({ page }) => {
	await expect(page.getByLabel("Antwoord van ChatGPT")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Antwoord controleren en invullen" }),
	).toHaveCount(0);
});

Then("the ChatGPT preference fields are unavailable", async ({ page }) => {
	await expect(page.getByLabel("Onderwerp of gebeurtenis")).toHaveCount(0);
});

Then("the Open ChatGPT action has focus", async ({ page }) => {
	await expect(
		page.getByRole("link", { name: "Open ChatGPT in een nieuw tabblad" }),
	).toBeFocused();
});

Then("the ChatGPT handoff fits the viewport", async ({ page }) => {
	const geometry = await page
		.locator("#chatgpt-handoff-title")
		.evaluate(() => ({
			documentWidth: document.documentElement.scrollWidth,
			viewportWidth: window.innerWidth,
		}));
	expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
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

Then(
	"the copied request requires one JSON code block in the answer",
	async ({ page }) => {
		const copied = await page.evaluate(
			() => (window as ClipboardTestWindow).copiedChatGptInstructions ?? "",
		);
		expect(copied).toContain(
			"Geef uitsluitend één Markdown-codeblok met taal json.",
		);
		expect(copied).toContain("```json");
		expect(copied).not.toContain("Gebruik geen Markdown-codeblok");
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
		await expect(page.locator(`[id="${descriptionId}"]`)).toContainText(
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
	"the exact AI classroom preview fits as a slide on a narrow teacher screen",
	async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await page.getByRole("button", { name: "Klasvoorbeeld openen" }).click();
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		await dialog.getByText("12 min", { exact: true }).click();
		await dialog.getByRole("button", { name: "Start", exact: true }).click();
		const preview = dialog.locator('[data-classroom-player-variant="preview"]');
		await expect(preview).toBeVisible();
		await expect(preview.locator('[data-beat-phase="opening"]')).toBeVisible();
		await expect(preview.locator("[data-source-card]")).toHaveCount(2);
		await expect(
			preview.getByRole("button", { name: "Volgende", exact: true }),
		).toBeVisible();
		await expect(
			preview.getByRole("button", { name: "Terug", exact: true }),
		).toBeDisabled();
		const stageRegion = preview.locator("[data-classroom-stage-region]");
		const layout = await stageRegion.evaluate((element) => ({
			overflowX: getComputedStyle(element).overflowX,
			overflowY: getComputedStyle(element).overflowY,
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			documentClientWidth: document.documentElement.clientWidth,
			documentScrollWidth: document.documentElement.scrollWidth,
		}));
		expect(["auto", "hidden"]).toContain(layout.overflowY);
		if (layout.scrollHeight > layout.clientHeight + 1) {
			expect(layout.overflowY).toBe("auto");
		}
		expect(layout.overflowX).toBe("hidden");
		expect(layout.documentScrollWidth).toBeLessThanOrEqual(
			layout.documentClientWidth + 1,
		);
		await dialog.getByRole("button", { name: "Terug naar controle" }).click();
	},
);

Then("AI source review comes before claim review", async ({ page }) => {
	const positions = await page.evaluate(() => ({
		sources: document.getElementById("ai-sources-title")?.offsetTop ?? 0,
		claims: document.getElementById("ai-claims-title")?.offsetTop ?? 0,
	}));
	expect(positions.sources).toBeLessThan(positions.claims);
});

Then("AI review progress starts incomplete", async ({ page }) => {
	await expect(
		page.getByText(/Bronnen 0\/2 · Beweringen 0\/\d+/),
	).toBeVisible();
});

Then("the first incomplete AI source action has focus", async ({ page }) => {
	await expect(
		page.getByRole("link", {
			name: "Werkelijke eerste brontitel openen in een nieuw tabblad",
		}),
	).toBeFocused();
});

Then(
	"AI review progress shows all sources checked before claims",
	async ({ page }) => {
		await expect(
			page.getByText(/Bronnen 2\/2 · Beweringen 0\/\d+/),
		).toBeVisible();
	},
);

Then("the first AI claim confirmation has focus", async ({ page }) => {
	await expect(
		page.getByRole("checkbox", {
			name: "Ik heb bewering 1 met de gekoppelde bronnen gecontroleerd",
		}),
	).toBeFocused();
});

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

Then(
	"the Cleopatra BCE story, sources, and activity are restored",
	async ({ page }) => {
		await expect(
			page.getByLabel("Hoe precies is de datum bekend?"),
		).toHaveValue("year");
		await expect(page.getByLabel("Tijdrekening")).toHaveValue("bce");
		await expect(page.getByLabel("Jaar")).toHaveValue("31");
		await page
			.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
			.click();
		await expect(page.getByLabel("Titel van bron 1")).toHaveValue(
			"Cleopatra VII",
		);
		await expect(page.getByLabel("Titel van bron 2")).toHaveValue(
			"Battle of Actium",
		);
		await page
			.getByRole("button", { name: "Ga verder naar klasactiviteit" })
			.click();
		await expect(page.locator('[id="beat.question"]')).toHaveValue(
			/Welke bron helpt het best/,
		);
		await expect(page.getByLabel("Hoe antwoorden leerlingen?")).toHaveValue(
			"response-cards",
		);
	},
);

Then("the Cleopatra article and AI review are shown", async ({ page }) => {
	await expect(
		page.getByRole("article").getByRole("heading", {
			name: "Cleopatra VII en de slag bij Actium",
		}),
	).toBeVisible();
	const review = page.getByRole("region", {
		name: "Controle van ChatGPT-voorstel",
	});
	await expect(
		review.getByRole("heading", { name: "Bewering 4" }),
	).toBeVisible();
	await expect(review).toContainText("Romeinse controle");
});

Then(
	"the actual Iron Curtain sources and activity are restored",
	async ({ page }) => {
		await page
			.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
			.click();
		await expect(page.getByLabel("Titel van bron 1")).toHaveValue(
			"The Sinews of Peace, 1946",
		);
		await expect(page.getByLabel("Titel van bron 3")).toHaveValue(
			/Foreign Relations of the United States/,
		);
		await page
			.getByRole("button", { name: "Ga verder naar klasactiviteit" })
			.click();
		await expect(page.locator('[id="beat.question"]')).toHaveValue(
			/Toen Churchill op 5 maart 1946/,
		);
	},
);

Then("the actual Iron Curtain claims are restored", async ({ page }) => {
	await expect(
		page.getByRole("region", { name: "Controle van ChatGPT-voorstel" }),
	).toContainText(
		"Het IJzeren Gordijn had niet overal en op elk moment dezelfde fysieke vorm",
	);
	await expect(page.getByRole("heading", { name: "Bewering 5" })).toBeVisible();
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

Then(
	"the dinosaur article and exact classroom activity are previewed",
	async ({ page }) => {
		await expect(
			page.getByRole("article").getByRole("heading", {
				name: "Het einde van de niet-vliegende dinosauriërs",
			}),
		).toBeVisible();
		await expect(page.getByText("ca. 66.000.000 v.Chr.")).toBeVisible();
		await page.getByRole("button", { name: "Klasvoorbeeld openen" }).click();
		const dialog = page.getByRole("dialog", { name: "Klasactiviteit" });
		await expect(dialog).toContainText(
			"Het einde van de niet-vliegende dinosauriërs",
		);
		await expect(dialog.getByRole("button", { name: "Start" })).toBeVisible();
		await dialog.getByRole("button", { name: "Terug naar controle" }).click();
	},
);

Then("dry-run publication is clearly not published", async ({ page }) => {
	await expect(
		page.getByText("Niet gepubliceerd", { exact: true }),
	).toBeVisible();
	await expect(page.locator("body")).toContainText(
		"Deze omgeving bewaart niets. Je voorbeeld blijft beschikbaar.",
	);
});

Then(
	"the dinosaur edit, sources, activity, and approximate date are restored",
	async ({ page }) => {
		await expect(page.getByLabel("Titel")).toHaveValue(
			"Het einde van de niet-vliegende dinosauriërs — herzien",
		);
		await expect(
			page.getByLabel("Hoe precies is de datum bekend?"),
		).toHaveValue("approximate");
		await expect(page.getByLabel("Tijdrekening")).toHaveValue("bce");
		await expect(page.getByLabel("Jaar")).toHaveValue("66000000");
		await page
			.getByRole("button", { name: "Ga verder naar indeling & bronnen" })
			.click();
		await expect(page.getByLabel("Titel van bron 2")).toHaveValue(
			"Sediment Swirls Off the Yucatán",
		);
		await page
			.getByRole("button", { name: "Ga verder naar klasactiviteit" })
			.click();
		await expect(
			page.getByLabel("Een verhaal met klasactiviteit"),
		).toBeChecked();
		await expect(page.locator('[id="beat.question"]')).toHaveValue(
			/Waardoor verdwenen/,
		);
	},
);

Then("only the background article is previewed", async ({ page }) => {
	await expect(page.getByRole("article")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Klasvoorbeeld openen" }),
	).toHaveCount(0);
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
	const response = page.getByLabel("Antwoord van ChatGPT");
	if (!(await response.isVisible())) {
		await page.getByRole("button", { name: "Ik heb al een antwoord" }).click();
	}
	await expect(response).not.toHaveValue("");
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
	"the clipboard contains fenced repair instructions without the hostile paste",
	async ({ page }) => {
		const copied = await page.evaluate(
			() => (window as ClipboardTestWindow).copiedChatGptInstructions ?? "",
		);
		expect(copied).toContain("Herstel je vorige antwoord");
		expect(copied).toContain("één Markdown-codeblok met taal json");
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

Then(
	"I remain on classification with its required fields marked invalid",
	async ({ page }) => {
		await expect(
			page.getByRole("heading", { name: "Indeling & bronnen", level: 2 }),
		).toBeVisible();
		await expect(page.locator("#profiles")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		await expect(page.locator("#topics")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		for (const field of [
			"sources.0.title",
			"sources.0.publisher",
			"sources.0.url",
		]) {
			await expect(page.locator(`[id="${field}"]`)).toHaveAttribute(
				"aria-invalid",
				"true",
			);
		}
	},
);

Then("the saved draft can still be restored", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Onvoltooid concept gevonden" }),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Concept herstellen" }),
	).toBeEnabled();
});

Then("the stored draft decision has focus", async ({ page }) => {
	await expect(
		page.getByRole("heading", { name: "Onvoltooid concept gevonden" }),
	).toBeFocused();
});

Then(
	"the authoring workspace is unavailable until I decide",
	async ({ page }) => {
		await expect(page.getByLabel("Titel")).toHaveCount(0);
		await expect(
			page.getByRole("navigation", { name: "Voortgang" }),
		).toHaveCount(0);
	},
);

Then("the stored draft decision fits the viewport", async ({ page }) => {
	const geometry = await page
		.getByRole("region", { name: "Onvoltooid concept gevonden" })
		.evaluate((region) => ({
			left: region.getBoundingClientRect().left,
			right: region.getBoundingClientRect().right,
			documentWidth: document.documentElement.scrollWidth,
			viewportWidth: window.innerWidth,
		}));
	expect(geometry.left).toBeGreaterThanOrEqual(0);
	expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
	expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});

Then("the empty authoring workspace is available", async ({ page }) => {
	await expect(page.getByLabel("Titel")).toBeVisible();
	await expect(page.getByLabel("Titel")).toHaveValue("");
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

Then("no repair action can relabel the stale answer", async ({ page }) => {
	await expect(
		page.getByRole("button", { name: "Herstelinstructies kopiëren" }),
	).toHaveCount(0);
});

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

async function fillManualDinosaurBeat(page: import("@playwright/test").Page) {
	await selectActivityPart(page, 0);
	for (const [id, value] of Object.entries({
		"beat.question": "Waardoor verdwenen de niet-vliegende dinosauriërs?",
		"beat.choices.0.label": "Vooral de inslag",
		"beat.choices.1.label": "Vooral vulkanisme",
	})) {
		await page.locator(`[id="${id}"]`).fill(value);
	}
	const stages: Record<number, Record<string, string>> = {
		0: {
			stimulus:
				"Aan het einde van het Krijt verandert het leven op aarde plotseling.",
		},
		2: {
			title: "De krater",
			evidence:
				"De Chicxulubkrater wijst op een grote inslag ongeveer 66 miljoen jaar geleden.",
		},
		3: { prompt: "Welk detail steunt jouw eerste keuze?" },
		4: {
			title: "Donkere atmosfeer",
			evidence:
				"Stof en aerosolen konden zonlicht beperken en voedselketens verstoren.",
		},
		5: { prompt: "Wat verandert deze informatie aan je verklaring?" },
		6: {
			title: "Meer dan één factor",
			evidence: "Onderzoekers bespreken ook vulkanisme en klimaatverandering.",
		},
		7: { prompt: "Wat weten we zeker en waarover bestaat debat?" },
		10: {
			title: "Wat overleefde?",
			feedback:
				"Niet-vliegende dinosauriërs stierven uit; vogels overleefden als dinosauriërlijn.",
		},
		11: {
			bridge:
				"Hoe reconstrueren wetenschappers gebeurtenissen uit het diepe verleden?",
		},
	};
	for (const [stageIndex, fields] of Object.entries(stages)) {
		await selectActivityPart(page, Number(stageIndex) + 1);
		for (const [field, value] of Object.entries(fields)) {
			await page
				.locator(`[id="beat.stages.${stageIndex}.${field}"]`)
				.fill(value);
		}
	}
	await selectActivityPart(page, 11);
	await page
		.locator('[id="beat.stages.10.sourceIds"]')
		.getByLabel("Sediment Swirls Off the Yucatán")
		.check();
	await selectActivityPart(page, 13);
	await page
		.locator('[id="beat.sensitivityNotes.0"]')
		.fill("Spreek over niet-vliegende dinosauriërs; vogels zijn dinosauriërs.");
}

async function openChatGptResponseStep(page: import("@playwright/test").Page) {
	const response = page.getByLabel("Antwoord van ChatGPT");
	if (await response.isVisible()) return;
	await page.getByRole("button", { name: "Ik heb al een antwoord" }).click();
}

async function selectActivityPart(
	page: import("@playwright/test").Page,
	part: number,
) {
	const select = page.locator("#activity-part-select");
	if (await select.isVisible()) {
		await select.selectOption(String(part));
		return;
	}
	await page.locator(`[data-activity-part="${part}"]`).click();
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
		/Gebruik bij succes exact deze envelop en vul alle voorbeeldtekst inhoudelijk in:\n```json\n([\s\S]*?)\n```\n\nREGELS VOOR HET OBJECT/.exec(
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
