import type { VakrichtingId } from "../content/taxonomy";

export const primaryLocale = "nl-BE" as const;

const collator = new Intl.Collator(primaryLocale);
const numberFormatter = new Intl.NumberFormat(primaryLocale);

export const historicalDateMessages = {
	months: [
		"januari",
		"februari",
		"maart",
		"april",
		"mei",
		"juni",
		"juli",
		"augustus",
		"september",
		"oktober",
		"november",
		"december",
	],
	afterCommonEra: "n.Chr.",
	beforeCommonEra: "v.Chr.",
	circa: "ca.",
} as const;

const vakrichtingLabels: Record<VakrichtingId, string> = {
	algemeen: "Algemeen",
	"auto-mechanica": "Auto & mechanica",
	elektriciteit: "Elektriciteit",
	bouw: "Bouw",
	hout: "Hout",
	metaal: "Metaal",
	"logistiek-transport": "Logistiek & transport",
};

const eventTagLabels: Record<string, string> = {
	belgie: "België",
};

export function compareLocalized(left: string, right: string): number {
	return collator.compare(left, right);
}

export function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

export function formatVakrichting(value: VakrichtingId): string {
	return vakrichtingLabels[value];
}

export function formatEventTag(value: string): string {
	return (
		eventTagLabels[value] ??
		value
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ")
	);
}

export function formatStep(position: number, total: number): string {
	return `Stap ${position} van ${total}`;
}

export function formatSourceHeading(position: number): string {
	return `Bron ${position}`;
}

export function formatSourceMove(
	position: number,
	direction: "up" | "down",
): string {
	return `Bron ${position} ${direction === "up" ? "omhoog" : "omlaag"} verplaatsen`;
}

export function formatSourceLabel(
	field: "title" | "publisher" | "url",
	position: number,
): string {
	const prefix = { title: "Titel", publisher: "Uitgever", url: "URL" }[field];
	return `${prefix} van bron ${position}`;
}
