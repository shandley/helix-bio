// ── RS1 position-weight coefficients ─────────────────────────────────────────
// Doench et al. 2014 Nature Biotechnology doi:10.1038/nbt.3026
// Ported from CRISPOR doenchScore.py (Haeussler 2014, MIT license)
// Input context: 30-mer = [0:4] 4nt upstream + [4:24] 20nt guide + [24:27] PAM + [27:30] 3nt downstream
// Format: [0-based position in 30-mer, nucleotide(s), weight]
const RS1_PARAMS: ReadonlyArray<readonly [number, string, number]> = [
	[1, "G", -0.2753771],
	[2, "A", -0.3238875],
	[2, "C", 0.17212887],
	[3, "C", -0.1006662],
	[4, "C", -0.2018029],
	[4, "G", 0.24595663],
	[5, "A", 0.03644004],
	[5, "C", 0.09837684],
	[6, "C", -0.7411813],
	[6, "G", -0.3932644],
	[11, "A", -0.466099],
	[14, "A", 0.08537695],
	[14, "C", -0.013814],
	[15, "A", 0.27262051],
	[15, "C", -0.1190226],
	[15, "T", -0.2859442],
	[16, "A", 0.09745459],
	[16, "G", -0.1755462],
	[17, "C", -0.3457955],
	[17, "G", -0.6780964],
	[18, "A", 0.22508903],
	[18, "C", -0.5077941],
	[19, "G", -0.4173736],
	[19, "T", -0.054307],
	[20, "G", 0.37989937],
	[20, "T", -0.0907126],
	[21, "C", 0.05782332],
	[21, "T", -0.5305673],
	[22, "T", -0.8770074],
	[23, "C", -0.8762358],
	[23, "G", 0.27891626],
	[23, "T", -0.4031022],
	[24, "A", -0.0773007],
	[24, "C", 0.28793562],
	[24, "T", -0.2216372],
	[27, "G", -0.6890167],
	[27, "T", 0.11787758],
	[28, "C", -0.1604453],
	[29, "G", 0.38634258],
	[1, "GT", -0.6257787],
	[4, "GC", 0.30004332],
	[5, "AA", -0.8348362],
	[5, "TA", 0.76062777],
	[6, "GG", -0.4908167],
	[11, "GG", -1.5169074],
	[11, "TA", 0.7092612],
	[11, "TC", 0.49629861],
	[11, "TT", -0.5868739],
	[12, "GG", -0.3345637],
	[13, "GA", 0.76384993],
	[13, "GC", -0.5370252],
	[16, "TG", -0.7981461],
	[18, "GG", -0.6668087],
	[18, "TC", 0.35318325],
	[19, "CC", 0.74807209],
	[19, "TG", -0.3672668],
	[20, "AC", 0.56820913],
	[20, "CG", 0.32907207],
	[20, "GA", -0.8364568],
	[20, "GG", -0.7822076],
	[21, "TC", -1.029693],
	[22, "CG", 0.85619782],
	[22, "CT", -0.4632077],
	[23, "AA", -0.5794924],
	[23, "AG", 0.64907554],
	[24, "AG", -0.0773007],
	[24, "CG", 0.28793562],
	[24, "TG", -0.2216372],
	[26, "GT", 0.11787758],
	[28, "GG", -0.69774],
];

const RS1_INTERCEPT = 0.59763615;
const RS1_GC_HIGH = -0.1665878; // GC > 10 bases in guide
const RS1_GC_LOW = -0.2026259; // GC ≤ 10 bases in guide

// ── Types ─────────────────────────────────────────────────────────────────────

export type CasVariant = "SpCas9" | "SaCas9" | "Cas12a";
export type GuideFlag = "polyT" | "homopolymer" | "lowGC" | "highGC" | "missingContext";
export type ScoreMethod = "Doench2014-RS1" | "heuristic";

export interface GuideRNA {
	id: string;
	sequence: string; // protospacer only (no PAM), 5'→3' on guide strand
	pam: string;
	context: string; // 30-mer for SpCas9; guide for others
	position: number; // 0-indexed start of protospacer on the forward (+) strand
	strand: "+" | "-";
	onTargetScore: number; // 0–100
	scoreMethod: ScoreMethod;
	gcContent: number; // 0–1
	flags: GuideFlag[];
	featureHits: string[]; // placeholder; populated by caller if needed
}

export interface CRISPRDesignOptions {
	casVariant: CasVariant;
	strand: "both" | "+" | "-";
	minScore: number; // inclusive lower bound
	maxGuides: number;
}

interface CasConfig {
	guideLength: number;
	pamLength: number;
	pamPosition: "3prime" | "5prime";
	matchesPam: (pam: string) => boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAS_CONFIGS: Record<CasVariant, CasConfig> = {
	SpCas9: {
		guideLength: 20,
		pamLength: 3,
		pamPosition: "3prime",
		// NGG
		matchesPam: (p) => p.length >= 3 && p[1] === "G" && p[2] === "G",
	},
	SaCas9: {
		guideLength: 21,
		pamLength: 6,
		pamPosition: "3prime",
		// NNGRRT: pos2=G, pos3∈{A,G}, pos4∈{A,G}, pos5=T
		matchesPam: (p) =>
			p.length >= 6 &&
			p[2] === "G" &&
			(p[3] === "A" || p[3] === "G") &&
			(p[4] === "A" || p[4] === "G") &&
			p[5] === "T",
	},
	Cas12a: {
		guideLength: 23,
		pamLength: 4,
		pamPosition: "5prime",
		// TTTV: T,T,T,{A,C,G}
		matchesPam: (p) =>
			p.length >= 4 &&
			p[0] === "T" &&
			p[1] === "T" &&
			p[2] === "T" &&
			p[3] !== "T" &&
			p[3] !== undefined,
	},
};

const RC_MAP: Record<string, string> = {
	A: "T",
	T: "A",
	G: "C",
	C: "G",
	N: "N",
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function reverseComplement(seq: string): string {
	let rc = "";
	for (let i = seq.length - 1; i >= 0; i--) {
		rc += RC_MAP[seq[i]?.toUpperCase() ?? ""] ?? "N";
	}
	return rc;
}

/** Doench 2014 RS1 on-target score for SpCas9.
 *  context30 must be a 30-mer: 4nt upstream + 20nt guide + 3nt PAM + 3nt downstream.
 *  Returns 0–100. */
export function scoreSpCas9(context30: string): number {
	const ctx = context30.toUpperCase();
	if (ctx.length < 30) return 0;

	let score = RS1_INTERCEPT;

	const guide = ctx.slice(4, 24);
	const gcCount = (guide.match(/[GC]/g) ?? []).length;
	score += Math.abs(10 - gcCount) * (gcCount <= 10 ? RS1_GC_LOW : RS1_GC_HIGH);

	for (const [pos, seq, weight] of RS1_PARAMS) {
		if (ctx.slice(pos, pos + seq.length) === seq) score += weight;
	}

	return Math.round(100 / (1 + Math.exp(-score)));
}

/** Heuristic on-target score for SaCas9 and Cas12a.
 *  GC tent function (peak 55%) with polyT and homopolymer penalties. */
function scoreHeuristic(guide: string): number {
	const g = guide.toUpperCase();
	const gc = (g.match(/[GC]/g) ?? []).length / g.length;
	// Triangular score: 1.0 at 55% GC, 0 at ≤25% or ≥85%
	const gcScore = Math.max(0, 1 - Math.abs(gc - 0.55) / 0.3);
	let penalty = 1.0;
	if (/TTTT/.test(g)) penalty *= 0.2;
	if (/(.)\1{4}/i.test(g)) penalty *= 0.5; // 5+ homopolymer run
	return Math.max(0, Math.round(100 * gcScore * penalty));
}

export function detectFlags(guide: string): GuideFlag[] {
	const g = guide.toUpperCase();
	const flags: GuideFlag[] = [];
	if (/TTTT/.test(g)) flags.push("polyT");
	if (/(.)\1{4}/i.test(g)) flags.push("homopolymer");
	const gc = (g.match(/[GC]/g) ?? []).length / g.length;
	if (gc < 0.25) flags.push("lowGC");
	if (gc > 0.75) flags.push("highGC");
	return flags;
}

/** Build a 30-mer context window for RS1 scoring, N-padding at sequence edges. */
function buildContext30(seq: string, guideStart: number, pamLen: number): string {
	const target = 30; // 4 + 20 + 3 + 3
	const ctxStart = guideStart - 4;
	let ctx = "";
	for (let i = 0; i < target; i++) {
		const pos = ctxStart + i;
		ctx += pos >= 0 && pos < seq.length ? (seq[pos] ?? "N").toUpperCase() : "N";
	}
	// Suppress: if pamLen < 3 we don't have full PAM context
	void pamLen;
	return ctx;
}

// ── Guide scanning ────────────────────────────────────────────────────────────

interface RawHit {
	guide: string;
	pam: string;
	context: string;
	scanPos: number; // position in the scanned sequence (for position mapping)
	hasFullContext: boolean;
}

function scanForGuides(seq: string, config: CasConfig): RawHit[] {
	const n = seq.length;
	const hits: RawHit[] = [];

	if (config.pamPosition === "3prime") {
		const step = config.guideLength + config.pamLength;
		for (let p = 0; p + step <= n; p++) {
			const pam = seq.slice(p + config.guideLength, p + step);
			if (!config.matchesPam(pam)) continue;
			const guide = seq.slice(p, p + config.guideLength);
			if (/N/i.test(guide)) continue;
			const hasFullContext = p >= 4 && p + step + 3 <= n;
			const context = config.guideLength === 20 ? buildContext30(seq, p, config.pamLength) : guide;
			hits.push({ guide, pam, context, scanPos: p, hasFullContext });
		}
	} else {
		// Cas12a: 5' PAM
		const step = config.pamLength + config.guideLength;
		for (let p = 0; p + step <= n; p++) {
			const pam = seq.slice(p, p + config.pamLength);
			if (!config.matchesPam(pam)) continue;
			const guideStart = p + config.pamLength;
			const guide = seq.slice(guideStart, guideStart + config.guideLength);
			if (/N/i.test(guide)) continue;
			hits.push({ guide, pam, context: guide, scanPos: guideStart, hasFullContext: true });
		}
	}

	return hits;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function designGuides(seq: string, opts: CRISPRDesignOptions): GuideRNA[] {
	const seqUC = seq.toUpperCase().replace(/[^ACGTN]/g, "N");
	const config = CAS_CONFIGS[opts.casVariant];
	const rcSeq = reverseComplement(seqUC);
	const origLen = seqUC.length;
	const results: GuideRNA[] = [];

	const strands: Array<"+" | "-"> = opts.strand === "both" ? ["+", "-"] : [opts.strand];

	for (const strand of strands) {
		const scanSeq = strand === "+" ? seqUC : rcSeq;
		const hits = scanForGuides(scanSeq, config);

		for (const hit of hits) {
			// Map scan position back to original sequence coordinates
			// For 3' PAM: protospacer in scan at [scanPos, scanPos+guideLen)
			// For 5' PAM: protospacer in scan at [scanPos, scanPos+guideLen) (guideStart in scan)
			const rcGuideStart = hit.scanPos;
			const origPos = strand === "+" ? rcGuideStart : origLen - rcGuideStart - config.guideLength;

			if (origPos < 0 || origPos + config.guideLength > origLen) continue;

			const gc = (hit.guide.match(/[GC]/g) ?? []).length / hit.guide.length;

			let onTargetScore: number;
			let scoreMethod: ScoreMethod;

			if (opts.casVariant === "SpCas9") {
				onTargetScore = scoreSpCas9(hit.context);
				scoreMethod = "Doench2014-RS1";
			} else {
				onTargetScore = scoreHeuristic(hit.guide);
				scoreMethod = "heuristic";
			}

			const flags = detectFlags(hit.guide);
			if (!hit.hasFullContext && opts.casVariant === "SpCas9") {
				flags.push("missingContext");
			}

			if (onTargetScore < opts.minScore) continue;

			results.push({
				id: `${origPos}${strand}`,
				sequence: hit.guide,
				pam: hit.pam,
				context: hit.context,
				position: origPos,
				strand,
				onTargetScore,
				scoreMethod,
				gcContent: gc,
				flags,
				featureHits: [],
			});
		}
	}

	// Sort by score descending, limit
	results.sort((a, b) => b.onTargetScore - a.onTargetScore);
	return results.slice(0, opts.maxGuides);
}
