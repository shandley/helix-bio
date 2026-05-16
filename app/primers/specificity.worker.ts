// Primer specificity checker — runs off the main thread.
// Loads features.json once per worker lifetime, then for each query primer
// checks whether its 3' end (last 15 bp) can bind anywhere in the database.
//
// A 15-mer match at the 3' end is the critical signal: mismatches only matter
// at the 3' end for polymerase extension, so a 5'-only match is much lower risk.

interface Feature {
	name: string;
	type: string;
	seq: string;
}

export interface SpecHit {
	featureName: string;
	featureType: string;
	// "sense" = primer seq found in feature → primer binds antisense strand of feature
	// "antisense" = rc(primer) found in feature → primer binds sense strand of feature
	strand: "sense" | "antisense";
}

export interface SpecRequest {
	primers: { id: string; seq: string }[];
}

export type SpecResponse =
	| { type: "results"; results: { id: string; hits: SpecHit[] }[] }
	| { type: "error"; message: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const KMER = 15;
const MIN_FEATURE_LEN = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };

function rc(s: string): string {
	return s
		.split("")
		.reverse()
		.map((b) => COMP[b] ?? "N")
		.join("");
}

// ── Feature cache ─────────────────────────────────────────────────────────────

let featureCache: Feature[] | null = null;

async function loadFeatures(): Promise<Feature[]> {
	if (featureCache) return featureCache;
	const resp = await fetch("/data/features.json");
	if (!resp.ok) throw new Error(`Failed to load feature database: ${resp.status}`);
	const all = (await resp.json()) as Feature[];
	featureCache = all.filter((f) => f.seq && f.seq.length >= MIN_FEATURE_LEN);
	return featureCache;
}

// ── Core check ────────────────────────────────────────────────────────────────

function checkPrimer(primerSeq: string, features: Feature[]): SpecHit[] {
	const p = primerSeq.toUpperCase();

	// 3' critical region and its reverse complement
	const end3 = p.slice(-KMER);
	const end3rc = rc(end3);

	const hits: SpecHit[] = [];
	const seen = new Set<string>();

	for (const feat of features) {
		if (seen.has(feat.name)) continue;
		const fs = feat.seq.toUpperCase();

		// Primer 3' end appears in feature sense strand
		// → primer would bind the antisense strand of this feature
		if (fs.includes(end3)) {
			hits.push({ featureName: feat.name, featureType: feat.type, strand: "antisense" });
			seen.add(feat.name);
			continue;
		}
		// RC of primer 3' end appears in feature sense strand
		// → primer would bind the sense strand of this feature
		if (fs.includes(end3rc)) {
			hits.push({ featureName: feat.name, featureType: feat.type, strand: "sense" });
			seen.add(feat.name);
		}
	}

	return hits;
}

// ── Worker entry ──────────────────────────────────────────────────────────────

self.addEventListener("message", async (e: MessageEvent<SpecRequest>) => {
	try {
		const features = await loadFeatures();

		const results = e.data.primers.map(({ id, seq }) => ({
			id,
			hits: checkPrimer(seq, features),
		}));

		const response: SpecResponse = { type: "results", results };
		self.postMessage(response);
	} catch (err) {
		const response: SpecResponse = {
			type: "error",
			message: (err as Error).message ?? "Specificity check failed",
		};
		self.postMessage(response);
	}
});
