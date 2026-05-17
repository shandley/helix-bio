import type { Metadata } from "next";
import { SangerTool } from "./sanger-tool";

export const metadata: Metadata = {
	title: "Sanger Analysis — Ori",
	description:
		"View .ab1 chromatograms, align Sanger reads against a reference sequence, and verify clones.",
};

export default function SangerPage() {
	return <SangerTool />;
}
