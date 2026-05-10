"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Demo plasmids are bundled as static GenBank files under public/demo/.
// Source notes:
//   pUC19    — sequence M77789 (NCBI), features hand-curated from NEB/literature
//   pBR322   — J01749 (NCBI, 48 features — excellent)
//   pACYC184 — X06403 (NCBI), TetA/CmR CDS added from sequence analysis
//   pGEX-4T-1 — U13853 (NCBI, 11 features: CDS + rep_origin)
//   pEGFP-N1 — U55762 (NCBI, correct 4733 bp sequence with egfp + neo CDS)
const DEMO_PLASMIDS = [
	{
		file: "pUC19.gb",
		name: "pUC19",
		note: "Common high-copy cloning vector. AmpR, lacZ-alpha, MCS. 2686 bp.",
	},
	{
		file: "pBR322.gb",
		name: "pBR322",
		note: "Classic cloning vector. AmpR + TetR. 4361 bp.",
	},
	{
		file: "pACYC184.gb",
		name: "pACYC184",
		note: "Low-copy compatible vector. CmR + TetR, p15A origin. 4245 bp.",
	},
	{
		file: "pGEX-4T-1.gb",
		name: "pGEX-4T-1",
		note: "GST fusion expression vector. AmpR, tac promoter, thrombin site. 4969 bp.",
	},
	{
		file: "pEGFP-N1.gb",
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

async function loadBundledGenBank(fileName: string): Promise<string | null> {
	try {
		// public/demo/ is resolved relative to the project root at build/runtime
		const filePath = join(process.cwd(), "public", "demo", fileName);
		const text = await readFile(filePath, "utf-8");
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

	// Build a map of existing demo sequences by name → id so we can upsert
	const { data: existing } = await supabase
		.from("sequences")
		.select("id, name")
		.eq("user_id", user.id);
	const existingById = new Map((existing ?? []).map((s) => [s.name, s.id]));

	let loaded = 0;
	let updated = 0;

	for (const plasmid of DEMO_PLASMIDS) {
		const content = await loadBundledGenBank(plasmid.file);
		if (!content) continue;

		const topology = detectTopology(content);
		const length = extractLength(content);
		const description = extractDefinition(content) || plasmid.note;
		const gcContent = computeGC(content);

		const fileName = `${plasmid.name}.gb`;
		const filePath = `${user.id}/demo/${fileName}`;

		// Always upload fresh bundled content to storage
		const { error: storageError } = await supabase.storage
			.from("sequences")
			.upload(filePath, new Blob([content], { type: "text/plain" }), {
				contentType: "text/plain",
				upsert: true,
			});

		if (storageError) continue;

		const existingId = existingById.get(plasmid.name);
		if (existingId) {
			// Update the existing DB record so the viewer gets the refreshed file
			const { error } = await supabase
				.from("sequences")
				.update({
					description,
					topology,
					length,
					gc_content: gcContent,
					file_path: filePath,
					file_format: "genbank",
				})
				.eq("id", existingId);
			if (!error) updated++;
		} else {
			const { error } = await supabase.from("sequences").insert({
				user_id: user.id,
				name: plasmid.name,
				description,
				topology,
				length,
				gc_content: gcContent,
				file_path: filePath,
				file_format: "genbank",
			});
			if (!error) loaded++;
		}
	}

	revalidatePath("/dashboard");
	const total = loaded + updated;
	return total > 0 ? { count: total } : { count: 0, alreadyLoaded: true };
}
