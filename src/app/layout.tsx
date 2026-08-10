import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Newsreader } from "next/font/google";
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
		default: "Toen.",
		template: "%s | Toen.",
	},
	description: "Historische gebeurtenissen, verteld vanuit hun eigen dag.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="nl">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
			</head>
			<body className={`${bodyFont.variable} ${displayFont.variable}`}>
				{children}
			</body>
		</html>
	);
}
