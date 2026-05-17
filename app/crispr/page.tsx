import type { Metadata } from "next";
import { Suspense } from "react";
import { CrisprTool } from "./crispr-tool";

export const metadata: Metadata = {
	title: "CRISPR Guide Design — Ori",
	description:
		"Design SpCas9, SaCas9, and Cas12a guide RNAs with on-target scoring. Free, browser-based, no login required.",
};

export default function CrisprPage() {
	return (
		<Suspense>
			<CrisprTool />
		</Suspense>
	);
}
