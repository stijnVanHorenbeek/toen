export type HistoricalVisual = {
	src: string;
	width: number;
	height: number;
	alt: string;
	caption: string;
	credit: string;
	license: string;
	licenseRationale: string;
	sourceUrl: string;
	originalUrl: string;
	derivative: string;
	sha256: string;
	focalPoint: string;
};

export const historicalVisuals = {
	"apollo-11-aldrin": {
		src: "/media/assets/2d514da09e22846759e1552189646ee456a973fa641399599875dc10bae7c5cb.webp",
		width: 1_800,
		height: 1_800,
		alt: "Buzz Aldrin staat op het maanoppervlak naast een poot van maanlander Eagle.",
		caption: "Buzz Aldrin tijdens Apollo 11, 20 juli 1969.",
		credit: "Neil A. Armstrong / NASA",
		license: "Publiek domein",
		licenseRationale: "Officiële NASA-foto (PD-USGov-NASA).",
		sourceUrl: "https://commons.wikimedia.org/wiki/File:Aldrin_Apollo_11.jpg",
		originalUrl:
			"https://upload.wikimedia.org/wikipedia/commons/9/9c/Aldrin_Apollo_11.jpg",
		derivative: "WebP-conversie, verkleind naar 1800 × 1800 pixels.",
		sha256: "2d514da09e22846759e1552189646ee456a973fa641399599875dc10bae7c5cb",
		focalPoint: "50% 42%",
	},
	"belgian-revolution-wappers": {
		src: "/media/assets/b8bc7ee21c4d138e330add00f2327e7bb289ed27dd327f09ae447b173b82473b.webp",
		width: 800,
		height: 554,
		alt: "Revolutionairen verzamelen zich met de Belgische driekleur op de Grote Markt van Brussel.",
		caption:
			"Episode van de Septemberdagen van 1830 op de Grote Markt van Brussel, geschilderd in 1834.",
		credit: "Gustaaf Wappers",
		license: "Publiek domein",
		licenseRationale:
			"Werk van Gustaaf Wappers (1803–1874); PD-old-100 en getrouwe reproductie van tweedimensionale kunst.",
		sourceUrl:
			"https://commons.wikimedia.org/wiki/File:Wappers_belgian_revolution.jpg",
		originalUrl:
			"https://upload.wikimedia.org/wikipedia/commons/9/90/Wappers_belgian_revolution.jpg",
		derivative:
			"WebP-conversie op oorspronkelijke afmetingen (800 × 554 pixels).",
		sha256: "b8bc7ee21c4d138e330add00f2327e7bb289ed27dd327f09ae447b173b82473b",
		focalPoint: "58% 48%",
	},
	"d-day-omaha-beach": {
		src: "/media/assets/7c61a71b2f8b3bec106201460788bc91feadb4ac42534cbe95bfa3afc425ea81.webp",
		width: 1_800,
		height: 1_426,
		alt: "Amerikaanse militairen verlaten een landingsvaartuig en waden door het water naar Omaha Beach.",
		caption: "Amerikaanse troepen naderen Omaha Beach op 6 juni 1944.",
		credit: "Robert F. Sargent / U.S. Coast Guard",
		license: "Publiek domein",
		licenseRationale: "Officiële foto van de U.S. Coast Guard (PD-USGov).",
		sourceUrl:
			"https://commons.wikimedia.org/wiki/File:D-day_Normandy_Nara_26-G-2343.jpg",
		originalUrl:
			"https://upload.wikimedia.org/wikipedia/commons/d/dc/D-day_Normandy_Nara_26-G-2343.jpg",
		derivative: "WebP-conversie, verkleind naar 1800 × 1426 pixels.",
		sha256: "7c61a71b2f8b3bec106201460788bc91feadb4ac42534cbe95bfa3afc425ea81",
		focalPoint: "50% 54%",
	},
	"fall-of-constantinople-dudley": {
		src: "/media/assets/6a2ff4521055ff3d04b2c58d3b543a8dc905bd1a805d3789ba74d1f5d3440cda.webp",
		width: 725,
		height: 959,
		alt: "Historische illustratie van Ottomaanse troepen die de muren van Constantinopel bestormen.",
		caption:
			"De val van Constantinopel, illustratie uit Hutchinson's History of the Nations, 1915.",
		credit: "Ambrose Dudley",
		license: "Publiek domein",
		licenseRationale:
			"Werk van Ambrose Dudley (1867–1951); PD-old-70 en getrouwe reproductie van tweedimensionale kunst.",
		sourceUrl:
			"https://commons.wikimedia.org/wiki/File:The_Fall_of_Constantinople,.jpg",
		originalUrl:
			"https://upload.wikimedia.org/wikipedia/commons/4/4c/The_Fall_of_Constantinople%2C.jpg",
		derivative:
			"WebP-conversie op oorspronkelijke afmetingen (725 × 959 pixels).",
		sha256: "6a2ff4521055ff3d04b2c58d3b543a8dc905bd1a805d3789ba74d1f5d3440cda",
		focalPoint: "50% 45%",
	},
} as const satisfies Record<string, HistoricalVisual>;

export type HistoricalVisualId = keyof typeof historicalVisuals;

const eventVisualIds: Record<string, HistoricalVisualId> = {
	"apollo-11-1969": "apollo-11-aldrin",
	"belgium-independence-1830": "belgian-revolution-wappers",
	"d-day-de-geallieerde-landing-in-normandie-1944": "d-day-omaha-beach",
	"val-van-constantinopel-1453": "fall-of-constantinople-dudley",
	"constantinopel-valt-1453": "fall-of-constantinople-dudley",
};

export function getEventVisualId(slug: string): HistoricalVisualId | null {
	return eventVisualIds[slug] ?? null;
}

export function getEventVisual(slug: string): HistoricalVisual | null {
	const visualId = getEventVisualId(slug);
	return visualId ? historicalVisuals[visualId] : null;
}
