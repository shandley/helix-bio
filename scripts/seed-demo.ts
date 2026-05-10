/**
 * One-time script to seed the demo account with example plasmids.
 * Run: npx tsx scripts/seed-demo.ts
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mexubhrfyfeacpnygpig.supabase.co";
// biome-ignore lint/style/noNonNullAssertion: must be set to run seed script
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEMO_USER_ID = "98089d07-1bdc-47f8-baa6-79c081bab536";

const DEMO_PLASMIDS = [
	{
		file: "pUC19.gb",
		name: "pUC19",
		note: "Common high-copy cloning vector. AmpR, lacZ-alpha, MCS. 2686 bp.",
	},
	{ file: "pBR322.gb", name: "pBR322", note: "Classic cloning vector. AmpR + TetR. 4361 bp." },
	{
		file: "pACYC184.gb",
		name: "pACYC184",
		note: "Low-copy compatible vector. CmR + TetR, p15A origin. 4245 bp.",
	},
	{
		file: "pGEX-4T-1.gb",
		name: "pGEX-4T-1",
		note: "GST fusion expression vector. AmpR, tac promoter. 4969 bp.",
	},
	{
		file: "pEGFP-N1.gb",
		name: "pEGFP-N1",
		note: "EGFP expression vector. NeoR/KanR, CMV promoter. 4733 bp.",
	},
];

function detectTopology(content: string): "circular" | "linear" {
	return content.split("\n")[0]?.toLowerCase().includes("circular") ? "circular" : "linear";
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

async function main() {
	if (!SERVICE_ROLE_KEY) {
		console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
		process.exit(1);
	}

	const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	let seeded = 0;

	for (const plasmid of DEMO_PLASMIDS) {
		const filePath = join(process.cwd(), "public", "demo", plasmid.file);
		const content = await readFile(filePath, "utf-8");
		if (!content.startsWith("LOCUS")) {
			console.warn(`Skipping ${plasmid.file} — not GenBank`);
			continue;
		}

		const topology = detectTopology(content);
		const length = extractLength(content);
		const description = extractDefinition(content) || plasmid.note;
		const gcContent = computeGC(content);
		const storagePath = `${DEMO_USER_ID}/demo/${plasmid.name}.gb`;

		const { error: uploadErr } = await supabase.storage
			.from("sequences")
			.upload(storagePath, new Blob([content], { type: "text/plain" }), { upsert: true });

		if (uploadErr) {
			console.error(`Upload failed for ${plasmid.name}:`, uploadErr.message);
			continue;
		}

		// Upsert DB record (delete existing by name+user first)
		await supabase.from("sequences").delete().eq("user_id", DEMO_USER_ID).eq("name", plasmid.name);

		const { error: insertErr } = await supabase.from("sequences").insert({
			user_id: DEMO_USER_ID,
			name: plasmid.name,
			description,
			topology,
			length,
			gc_content: gcContent,
			file_path: storagePath,
			file_format: "genbank",
		});

		if (insertErr) {
			console.error(`DB insert failed for ${plasmid.name}:`, insertErr.message);
			continue;
		}

		console.log(`✓ ${plasmid.name} — ${length} bp, ${topology}, GC ${gcContent?.toFixed(1)}%`);
		seeded++;
	}

	console.log(`\nSeeded ${seeded}/${DEMO_PLASMIDS.length} plasmids for demo@ori.bio`);
}

main().catch(console.error);
