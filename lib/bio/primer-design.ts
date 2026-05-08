// SantaLucia 1998 unified nearest-neighbor parameters (DNA/DNA, 1M NaCl)
// Key: 5'→3' dinucleotide on top strand. Values: dH (kcal/mol), dS (cal/mol/K)
const NN: Record<string, { dH: number; dS: number }> = {
	AA: { dH: -7.9, dS: -22.2 }, TT: { dH: -7.9, dS: -22.2 },
	AT: { dH: -7.2, dS: -20.4 },
	TA: { dH: -7.2, dS: -21.3 },
	CA: { dH: -8.5, dS: -22.7 }, TG: { dH: -8.5, dS: -22.7 },
	GT: { dH: -8.4, dS: -22.4 }, AC: { dH: -8.4, dS: -22.4 },
	CT: { dH: -7.8, dS: -21.0 }, AG: { dH: -7.8, dS: -21.0 },
	GA: { dH: -8.2, dS: -22.2 }, TC: { dH: -8.2, dS: -22.2 },
	CG: { dH: -10.6, dS: -27.2 },
	GC: { dH: -9.8,  dS: -24.4 },
	GG: { dH: -8.0, dS: -19.9 }, CC: { dH: -8.0, dS: -19.9 },
};

// Initiation parameters (SantaLucia 1998 Table 2)
const INIT_GC = { dH: 0.1,  dS: -2.8 };
const INIT_AT = { dH: 2.3,  dS:  4.1 };

const R = 1.987; // cal/mol/K (gas constant)

const COMP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };

export function reverseComplement(seq: string): string {
	return seq
		.split("")
		.reverse()
		.map((b) => COMP[b] ?? "N")
		.join("");
}

export interface TmOptions {
	/** Total primer concentration in mol/L. Default: 250 nM */
	oligoConc?: number;
	/** Monovalent cation concentration in mol/L. Default: 50 mM */
	naConc?: number;
}

/** Nearest-neighbor Tm (°C) using SantaLucia 1998 + monovalent salt correction. */
export function calcTm(seq: string, opts: TmOptions = {}): number {
	const CT = opts.oligoConc ?? 250e-9;
	const na = opts.naConc ?? 0.05;

	const s = seq.toUpperCase();
	let dH = 0;
	let dS = 0;

	// Sum nearest-neighbor pairs
	for (let i = 0; i < s.length - 1; i++) {
		const pair = s[i] + s[i + 1];
		const p = NN[pair];
		if (p) { dH += p.dH; dS += p.dS; }
	}

	// Initiation: add one term per terminal base pair
	const terminals = [s[0], s[s.length - 1]];
	for (const b of terminals) {
		const init = b === "G" || b === "C" ? INIT_GC : INIT_AT;
		dH += init.dH;
		dS += init.dS;
	}

	// Tm at 1M NaCl (non-self-complementary → use CT/4)
	const tm1M = (dH * 1000) / (dS + R * Math.log(CT / 4)) - 273.15;

	// Monovalent salt correction
	return tm1M + 16.6 * Math.log10(na);
}

export function calcGC(seq: string): number {
	const s = seq.toUpperCase();
	const gc = [...s].filter((b) => b === "G" || b === "C").length;
	return gc / s.length;
}

/** Max consecutive run of any single nucleotide. */
function maxPolyRun(seq: string): number {
	let max = 1, cur = 1;
	for (let i = 1; i < seq.length; i++) {
		cur = seq[i] === seq[i - 1] ? cur + 1 : 1;
		if (cur > max) max = cur;
	}
	return max;
}

/**
 * Hairpin score: length of the longest stem that could form (≥4 bp stem,
 * ≥3 bp loop) within the primer. Higher = worse.
 */
function hairpinStem(seq: string): number {
	const n = seq.length;
	let max = 0;
	for (let i = 0; i < n - 7; i++) {
		for (let j = n - 1; j >= i + 7; j--) {
			let stem = 0;
			while (
				i + stem < j - stem &&
				COMP[seq[i + stem]] === seq[j - stem]
			) stem++;
			const loopSize = j - i - 2 * stem + 1;
			if (stem >= 4 && loopSize >= 3) max = Math.max(max, stem);
		}
	}
	return max;
}

/**
 * Max consecutive complementary bases at the 3' end of `seq` against any
 * window in `against`. Used for self-dimer and pair-dimer checks.
 */
function threeEndComplement(seq: string, against: string): number {
	const n = seq.length;
	const m = against.length;
	let max = 0;
	// Walk inward from seq's 3' end
	for (let offset = 0; offset < m; offset++) {
		let run = 0;
		for (let k = 0; k < 5 && k < n && offset + k < m; k++) {
			if (COMP[seq[n - 1 - k]] === against[offset + k]) run++;
			else break;
		}
		if (run > max) max = run;
	}
	return max;
}

/** Count off-target exact binding sites in template (not at the expected location). */
function offTargetCount(
	primerSeq: string,
	template: string,
	expectedStart: number,
): number {
	const circular = template; // already full template
	const n = template.length;
	let count = 0;
	for (let i = 0; i <= n - primerSeq.length; i++) {
		if (Math.abs(i - expectedStart) < primerSeq.length) continue; // expected site
		if (template.slice(i, i + primerSeq.length) === primerSeq) count++;
	}
	return count;
}

export interface PrimerCandidate {
	seq: string;
	/** 0-indexed start on the template (+ strand) */
	bindStart: number;
	/** 0-indexed end on the template (+ strand), inclusive */
	bindEnd: number;
	direction: "fwd" | "rev";
	tm: number;
	gc: number;
	len: number;
	hairpin: number;
	selfDimer: number;
	offTarget: number;
	gcClamp: boolean;
	polyRun: number;
	/** Overall penalty score — lower is better */
	score: number;
}

export interface PrimerPair {
	fwd: PrimerCandidate;
	rev: PrimerCandidate;
	productSize: number;
	pairDimer: number;
	pairScore: number;
}

export interface PrimerDesignOptions extends TmOptions {
	minLen?: number;
	maxLen?: number;
	tmTarget?: number;
	gcMin?: number;
	gcMax?: number;
	maxPolyN?: number;
}

function scorePrimer(p: PrimerCandidate, tmTarget: number): number {
	let s = 0;
	// Tm deviation (weight 2)
	s += Math.abs(p.tm - tmTarget) * 2;
	// GC% deviation from 50% (weight 4)
	s += Math.abs(p.gc - 0.5) * 4;
	// GC clamp (prefer ending in G/C)
	if (!p.gcClamp) s += 4;
	// Hairpin (per bp above threshold)
	if (p.hairpin >= 4) s += (p.hairpin - 3) * 3;
	// Self-dimer at 3' end
	if (p.selfDimer >= 3) s += (p.selfDimer - 2) * 4;
	// Poly-N run
	if (p.polyRun > 4) s += (p.polyRun - 4) * 5;
	// Off-target hits
	s += p.offTarget * 10;
	return s;
}

function buildCandidate(
	seq: string,
	bindStart: number,
	direction: "fwd" | "rev",
	template: string,
	tmTarget: number,
	tmOpts: TmOptions,
): PrimerCandidate {
	const upper = seq.toUpperCase();
	const tm = calcTm(upper, tmOpts);
	const gc = calcGC(upper);
	const last = upper[upper.length - 1];
	const gcClamp = last === "G" || last === "C";
	const hairpin = hairpinStem(upper);
	const selfDimer = threeEndComplement(upper, upper);
	const polyRun = maxPolyRun(upper);
	const bindEnd = bindStart + seq.length - 1;

	const cand: PrimerCandidate = {
		seq: upper,
		bindStart,
		bindEnd,
		direction,
		tm,
		gc,
		len: seq.length,
		hairpin,
		selfDimer,
		offTarget: offTargetCount(upper, template.toUpperCase(), bindStart),
		gcClamp,
		polyRun,
		score: 0,
	};
	cand.score = scorePrimer(cand, tmTarget);
	return cand;
}

/**
 * Design forward + reverse primers flanking [targetStart, targetEnd] (0-indexed,
 * inclusive). Returns up to `topN` ranked pairs.
 */
export function designPrimers(
	template: string,
	targetStart: number,
	targetEnd: number,
	opts: PrimerDesignOptions = {},
): PrimerPair[] {
	const {
		minLen = 18,
		maxLen = 25,
		tmTarget = 60,
		gcMin = 0.4,
		gcMax = 0.65,
		maxPolyN = 4,
		oligoConc = 250e-9,
		naConc = 0.05,
	} = opts;

	const tmOpts: TmOptions = { oligoConc, naConc };
	const n = template.length;
	const upper = template.toUpperCase();

	const fwdCandidates: PrimerCandidate[] = [];
	const revCandidates: PrimerCandidate[] = [];

	// Forward primers: 3' end anchored near targetStart (primer ends just at/before target)
	for (let end3 = targetStart - 3; end3 <= targetStart + 3; end3++) {
		for (let L = minLen; L <= maxLen; L++) {
			const start = end3 - L + 1;
			if (start < 0 || end3 >= n) continue;
			const seq = upper.slice(start, end3 + 1);
			if (/[^ATGC]/.test(seq)) continue;
			const gc = calcGC(seq);
			if (gc < gcMin || gc > gcMax) continue;
			const poly = maxPolyRun(seq);
			if (poly > maxPolyN + 2) continue;
			fwdCandidates.push(buildCandidate(seq, start, "fwd", upper, tmTarget, tmOpts));
		}
	}

	// Reverse primers: binding site on + strand anchored near targetEnd
	// Reverse primer seq = revComp of template region ending at/near targetEnd
	for (let end3plus = targetEnd - 3; end3plus <= targetEnd + 3; end3plus++) {
		for (let L = minLen; L <= maxLen; L++) {
			const bindStart = end3plus - L + 1;
			if (bindStart < 0 || end3plus >= n) continue;
			const plusStrand = upper.slice(bindStart, end3plus + 1);
			if (/[^ATGC]/.test(plusStrand)) continue;
			const seq = reverseComplement(plusStrand);
			const gc = calcGC(seq);
			if (gc < gcMin || gc > gcMax) continue;
			const poly = maxPolyRun(seq);
			if (poly > maxPolyN + 2) continue;
			revCandidates.push(buildCandidate(seq, bindStart, "rev", upper, tmTarget, tmOpts));
		}
	}

	if (fwdCandidates.length === 0 || revCandidates.length === 0) return [];

	fwdCandidates.sort((a, b) => a.score - b.score);
	revCandidates.sort((a, b) => a.score - b.score);

	const topFwd = fwdCandidates.slice(0, 5);
	const topRev = revCandidates.slice(0, 5);

	// Build pairs from top candidates, adding pair-dimer penalty
	const pairs: PrimerPair[] = [];
	for (const fwd of topFwd) {
		for (const rev of topRev) {
			const productSize = rev.bindEnd - fwd.bindStart + 1;
			if (productSize < 50) continue;
			const pairDimer = Math.max(
				threeEndComplement(fwd.seq, rev.seq),
				threeEndComplement(rev.seq, fwd.seq),
			);
			const pairScore = fwd.score + rev.score + (pairDimer >= 3 ? (pairDimer - 2) * 6 : 0);
			pairs.push({ fwd, rev, productSize, pairDimer, pairScore });
		}
	}

	pairs.sort((a, b) => a.pairScore - b.pairScore);
	return pairs.slice(0, 5);
}
