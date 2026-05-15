import type { Metadata } from "next";
import { PrimerTool } from "./primer-tool";

export const metadata: Metadata = {
	title: "Primer Design — Ori",
	description:
		"Free browser-based primer design using SantaLucia 1998 nearest-neighbor thermodynamics with Owczarzy 2008 Mg²⁺ correction.",
};

export default function PrimersPage() {
	return <PrimerTool />;
}
