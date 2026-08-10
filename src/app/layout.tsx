import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
import { primaryLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages.nl-BE";
import "./globals.css";

const bodyFont = Atkinson_Hyperlegible({
	variable: "--font-body",
	subsets: ["latin"],
	weight: ["400", "700"],
});

const displayFont = Newsreader({
	variable: "--font-display",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: {
		default: messages.site.name,
		template: `%s | ${messages.site.name}`,
	},
	description: messages.site.description,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang={primaryLocale}>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
			</head>
			<body className={`${bodyFont.variable} ${displayFont.variable}`}>
				{children}
			</body>
		</html>
	);
}
