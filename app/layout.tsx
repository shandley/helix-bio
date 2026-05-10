import type { Metadata } from "next";
import { Courier_Prime, Karla, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
	variable: "--font-playfair",
	subsets: ["latin"],
	display: "swap",
});

const karla = Karla({
	variable: "--font-karla",
	subsets: ["latin"],
	display: "swap",
});

const courierPrime = Courier_Prime({
	variable: "--font-courier",
	subsets: ["latin"],
	weight: ["400", "700"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "Ori — Molecular Biology Workbench",
	description:
		"Open-source, AI-powered molecular biology workbench. Visualize plasmids, simulate cloning, design primers.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${playfair.variable} ${karla.variable} ${courierPrime.variable} h-full`}
		>
			<body className="h-full bg-background text-foreground antialiased">{children}</body>
		</html>
	);
}
