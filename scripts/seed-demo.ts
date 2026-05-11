/**
 * Seed a user account with example plasmids.
 *
 * Safe to run repeatedly — existing records are upserted, not duplicated.
 * New sequences are fetched from NCBI automatically and cached locally.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-demo.ts
 *   SUPABASE_SERVICE_ROLE_KEY=... SEED_USER_EMAIL=other@email.com npx tsx scripts/seed-demo.ts
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── Configuration ────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://mexubhrfyfeacpnygpig.supabase.co";
// biome-ignore lint/style/noNonNullAssertion: must be set to run
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL ?? "demo@ori.bio";
const DEMO_DIR = join(process.cwd(), "public", "demo");
const NCBI_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

// ── Plasmid catalogue ─────────────────────────────────────────────────────────
//
// source: "local"  → file already in public/demo/
// source: "ncbi"   → fetched from NCBI by accession and cached in public/demo/
//
// Adding a new sequence: append an entry with the NCBI accession and a note.
// The file will be downloaded on first run and reused on subsequent runs.

interface PlasmidEntry {
	file: string;
	name: string;
	note: string;
	source: "local" | "ncbi";
	accession?: string; // required when source === "ncbi"
}

const PLASMIDS: PlasmidEntry[] = [
	// ── Classic cloning vectors ───────────────────────────────────────────────
	{
		file: "pUC19.gb",
		name: "pUC19",
		note: "High-copy cloning vector. AmpR, lacZ-alpha, MCS. 2686 bp.",
		source: "local",
	},
	{
		file: "pBR322.gb",
		name: "pBR322",
		note: "Classic dual-resistance vector. AmpR + TetR. 4361 bp.",
		source: "local",
	},
	{
		file: "pACYC184.gb",
		name: "pACYC184",
		note: "Low-copy compatible vector. CmR + TetR, p15A origin. 4245 bp.",
		source: "local",
	},
	{
		file: "pBluescriptKS.gb",
		name: "pBluescript II KS(+)",
		note: "Sequencing and mutagenesis phagemid. T3/T7 promoters, lacZ MCS, f1 ori, AmpR. 2961 bp.",
		source: "ncbi",
		accession: "X52327",
	},

	// ── Bacterial expression ──────────────────────────────────────────────────
	{
		file: "pGEX-4T-1.gb",
		name: "pGEX-4T-1",
		note: "GST fusion expression vector. AmpR, Ptac promoter. 4969 bp.",
		source: "local",
	},
	{
		file: "pGEX-6P-1.gb",
		name: "pGEX-6P-1",
		note: "GST fusion with PreScission protease site. AmpR, lacIq. 4984 bp.",
		source: "ncbi",
		accession: "U78872",
	},
	{
		file: "pET-28a.gb",
		name: "pET-28a",
		note: "T7 bacterial expression. N-/C-terminal His-tag, KanR, lac operator. 5331 bp.",
		source: "ncbi",
		accession: "KJ782405",
	},

	// ── Mammalian / reporter ──────────────────────────────────────────────────
	{
		file: "pEGFP-N1.gb",
		name: "pEGFP-N1",
		note: "EGFP expression vector. CMV promoter, NeoR/KanR. 4733 bp.",
		source: "local",
	},
	{
		file: "pGL3-Basic.gb",
		name: "pGL3-Basic",
		note: "Promoter-less luciferase reporter. Firefly luc, AmpR, f1 ori. 4818 bp.",
		source: "ncbi",
		accession: "U47295",
	},
];

// ── NCBI fetch ────────────────────────────────────────────────────────────────

async function fetchFromNCBI(accession: string): Promise<string> {
	const url = `${NCBI_EFETCH}?db=nuccore&id=${accession}&rettype=gb&retmode=text`;
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`NCBI fetch failed for ${accession}: HTTP ${resp.status}`);
	const text = await resp.text();
	if (!text.startsWith("LOCUS")) {
		throw new Error(`NCBI response for ${accession} doesn't look like GenBank:\n${text.slice(0, 200)}`);
	}
	return text;
}

// ── GenBank parsing helpers ───────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
	if (!SERVICE_ROLE_KEY) {
		console.error("Set SUPABASE_SERVICE_ROLE_KEY env var");
		process.exit(1);
	}

	const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	// Look up user
	const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
	if (listErr) { console.error("Failed to list users:", listErr.message); process.exit(1); }
	const user = users.find((u) => u.email === SEED_USER_EMAIL);
	if (!user) {
		console.error(`User not found: ${SEED_USER_EMAIL}`);
		console.error("Available users:", users.map((u) => u.email).join(", "));
		process.exit(1);
	}
	console.log(`Seeding for: ${user.email} (${user.id})\n`);

	await mkdir(DEMO_DIR, { recursive: true });

	const results = { added: 0, updated: 0, skipped: 0, failed: 0 };

	for (const plasmid of PLASMIDS) {
		const filePath = join(DEMO_DIR, plasmid.file);

		// Fetch from NCBI if needed
		let content: string;
		try {
			if (plasmid.source === "ncbi" && !existsSync(filePath)) {
				process.stdout.write(`  Fetching ${plasmid.name} from NCBI (${plasmid.accession})…`);
				content = await fetchFromNCBI(plasmid.accession!);
				await writeFile(filePath, content);
				process.stdout.write(" cached\n");
			} else {
				content = await readFile(filePath, "utf-8");
			}
		} catch (e) {
			console.error(`\n  ✗ ${plasmid.name}: ${(e as Error).message}`);
			results.failed++;
			continue;
		}

		if (!content.startsWith("LOCUS")) {
			console.warn(`  ⚠ ${plasmid.name}: not a GenBank file — skipping`);
			results.skipped++;
			continue;
		}

		const topology = detectTopology(content);
		const length = extractLength(content);
		const description = extractDefinition(content) || plasmid.note;
		const gcContent = computeGC(content);
		const storagePath = `${user.id}/demo/${plasmid.file}`;

		// Upload to storage (upsert)
		const { error: uploadErr } = await supabase.storage
			.from("sequences")
			.upload(storagePath, new Blob([content], { type: "text/plain" }), { upsert: true });

		if (uploadErr) {
			console.error(`  ✗ ${plasmid.name} (storage): ${uploadErr.message}`);
			results.failed++;
			continue;
		}

		// Upsert DB record — check for existing entry first for accurate reporting
		const { data: existing } = await supabase
			.from("sequences")
			.select("id")
			.eq("user_id", user.id)
			.eq("name", plasmid.name)
			.maybeSingle();

		const record = {
			user_id: user.id,
			name: plasmid.name,
			description,
			topology,
			length,
			gc_content: gcContent,
			file_path: storagePath,
			file_format: "genbank",
		};

		if (existing) {
			const { error: updateErr } = await supabase
				.from("sequences")
				.update(record)
				.eq("id", existing.id);
			if (updateErr) {
				console.error(`  ✗ ${plasmid.name} (update): ${updateErr.message}`);
				results.failed++;
				continue;
			}
			console.log(`  ↻ ${plasmid.name} — updated (${length} bp, ${topology}, GC ${gcContent?.toFixed(1)}%)`);
			results.updated++;
		} else {
			const { error: insertErr } = await supabase.from("sequences").insert(record);
			if (insertErr) {
				console.error(`  ✗ ${plasmid.name} (insert): ${insertErr.message}`);
				results.failed++;
				continue;
			}
			console.log(`  ✓ ${plasmid.name} — added (${length} bp, ${topology}, GC ${gcContent?.toFixed(1)}%)`);
			results.added++;
		}
	}

	console.log(`
Done: ${results.added} added, ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed
User: ${SEED_USER_EMAIL}
`);
	if (results.failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
