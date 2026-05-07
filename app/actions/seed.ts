"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEMO_PLASMIDS = [
	{
		accession: "L09137",
		name: "pUC19",
		note: "Common high-copy cloning vector. AmpR, lacZ-alpha, MCS. 2686 bp.",
	},
	{
		accession: "J01749",
		name: "pBR322",
		note: "Classic cloning vector. AmpR + TetR. 4361 bp.",
	},
	{
		accession: "X06403",
		name: "pACYC184",
		note: "Low-copy compatible vector. CmR + TetR, p15A origin. 4245 bp.",
	},
	{
		accession: "U13872",
		name: "pGEX-4T-1",
		note: "GST fusion expression vector. AmpR, tac promoter, thrombin site.",
	},
	{
		accession: "AF177375",
		name: "pEGFP-N1",
		note: "EGFP expression vector. NeoR/KanR, CMV promoter. 4733 bp.",
	},
];

function detectTopology(content: string): "circular" | "linear" {
	const locusLine = content.split("\n")[0] ?? "";
	return locusLine.toLowerCase().includes("circular") ? "circular" : "linear";
}

function extractLength(content: string): number | null {
	const m = content.match(/^LOCUS\s+\S+\s+(\d+)\s+bp/im);
	return m ? parseInt(m[1], 10) : null;
}

function extractDefinition(content: string): string {
	const m = content.match(/^DEFINITION\s+([\s\S]+?)(?=\n[A-Z])/m);
	return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
}

function computeGC(content: string): number | null {
	const m = content.match(/ORIGIN([\s\S]*?)\/\//);
	if (!m) return null;
	const seq = m[1].replace(/[\d\s]/g, "").toUpperCase();
	if (!seq.length) return null;
	const gc = (seq.split("").filter((b) => b === "G" || b === "C").length / seq.length) * 100;
	return Math.round(gc * 100) / 100;
}

async function fetchGenBank(accession: string): Promise<string | null> {
	try {
		const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${accession}&rettype=gbwithparts&retmode=text`;
		const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
		if (!res.ok) return null;
		const text = await res.text();
		// Sanity-check: real GenBank records start with LOCUS
		return text.startsWith("LOCUS") ? text : null;
	} catch {
		return null;
	}
}

export async function populateDemoSequences() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { error: "Not authenticated" };

	// Check which demo sequences the user already has
	const { data: existing } = await supabase
		.from("sequences")
		.select("name")
		.eq("user_id", user.id);
	const existingNames = new Set((existing ?? []).map((s) => s.name));

	const toLoad = DEMO_PLASMIDS.filter((p) => !existingNames.has(p.name));
	if (toLoad.length === 0) return { count: 0, alreadyLoaded: true };

	let loaded = 0;

	for (const plasmid of toLoad) {
		const content = await fetchGenBank(plasmid.accession);
		if (!content) continue;

		const topology = detectTopology(content);
		const length = extractLength(content);
		const description = extractDefinition(content) || plasmid.note;
		const gcContent = computeGC(content);

		const fileName = `${plasmid.name}.gb`;
		const filePath = `${user.id}/demo/${fileName}`;

		const { error: storageError } = await supabase.storage
			.from("sequences")
			.upload(filePath, new Blob([content], { type: "text/plain" }), {
				contentType: "text/plain",
				upsert: true,
			});

		if (storageError) continue;

		const { error: dbError } = await supabase.from("sequences").insert({
			user_id: user.id,
			name: plasmid.name,
			description,
			topology,
			length,
			gc_content: gcContent,
			file_path: filePath,
			file_format: "genbank",
		});

		if (!dbError) loaded++;

		// Be polite to NCBI — max 3 req/s without API key
		await new Promise((r) => setTimeout(r, 400));
	}

	revalidatePath("/dashboard");
	return { count: loaded };
}
