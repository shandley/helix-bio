/**
 * Deterministic clone verification engine.
 *
 * Classifies every variant from Sanger alignment results, checks CDS codon
 * changes, computes per-feature sequencing coverage, and emits a typed verdict.
 *
 * The verdict is computed by pure deterministic rules — Claude receives this
 * output and writes the plain-English explanation, but never decides the verdict.
 */

import type { AlignmentResult } from "./align";
import { translate } from "./translate";

// ── Constants (named thresholds, not magic numbers) ───────────────────────────

/** All aligned reads must meet this identity to call CONFIRMED when CDS features exist. */
export const CONFIRMED_MIN_IDENTITY = 0.98;

/** Relaxed threshold when no CDS annotations are present (less information available). */
export const CONFIRMED_NO_CDS_IDENTITY = 0.95;

/** Phred quality below this value is flagged as likely sequencing error, not a real variant. */
export const LOW_QUALITY_THRESHOLD = 20;

/** A CDS feature must be at least this fraction covered to be considered fully sequenced. */
export const FULL_COVERAGE_THRESHOLD = 0.98;

// ── Input types ───────────────────────────────────────────────────────────────

export interface AnnotationSummary {
  name: string;
  type: string;
  start: number; // 0-indexed, inclusive
  end: number; // 0-indexed, exclusive
  direction: 1 | -1;
}

/** Minimal read input — compatible with AlignPanel's AlignRead shape. */
export interface ReadInput {
  name: string;
  result?: AlignmentResult;
}

// ── Output types ──────────────────────────────────────────────────────────────

export type VariantType = "substitution" | "insertion" | "deletion";

export type VariantEffect =
  | { kind: "intergenic" }
  | { kind: "inFeature"; featureName: string; featureType: string }
  | {
      kind: "inCDS";
      featureName: string;
      /** 0-based codon number within the CDS. */
      codonIndex: number;
      /** 1-based position within the codon (1, 2, or 3). */
      posInCodon: number;
      refCodon: string;
      altCodon: string;
      refAA: string;
      altAA: string;
      effect: "silent" | "missense" | "nonsense" | "frameshift" | "in-frame-indel";
    };

export interface ClassifiedVariant {
  refPos: number;
  queryPos: number;
  variantType: VariantType;
  /** Number of bases affected (1 for substitutions; >1 for grouped indels). */
  length: number;
  refBases: string; // "-" × length for insertions
  altBases: string; // "-" × length for deletions
  /** Phred score of the called base; undefined for reverse-strand reads (stripped in align.ts). */
  qualityScore?: number;
  /**
   * True when qualityScore is defined and < LOW_QUALITY_THRESHOLD.
   * Suppresses the variant from triggering MUTATION_DETECTED or FAILED verdicts.
   * Note: reverse-strand mismatches have no quality score and are never suppressed.
   */
  isLikelySequencingError: boolean;
  effect: VariantEffect;
}

export interface FeatureCoverage {
  name: string;
  type: string;
  start: number;
  end: number;
  direction: 1 | -1;
  /** Fraction of the feature's base positions covered by at least one aligned read [0, 1]. */
  coveredFraction: number;
  /** True when coveredFraction >= FULL_COVERAGE_THRESHOLD. */
  fullySequenced: boolean;
}

export interface ReadVerification {
  readName: string;
  aligned: boolean;
  strand: "+" | "-";
  refStart: number;
  refEnd: number;
  identity: number;
  coverage: number;
  variants: ClassifiedVariant[];
  silentCount: number;
  missenseCount: number;
  nonsenseCount: number;
  frameshiftCount: number;
  likelyErrorCount: number;
}

export type Verdict = "CONFIRMED" | "MUTATION_DETECTED" | "INCOMPLETE" | "FAILED";

export interface VerificationResult {
  verdict: Verdict;
  /** One-sentence human-readable explanation produced by deterministic code, not Claude. */
  verdictReason: string;
  reads: ReadVerification[];
  featureCoverage: FeatureCoverage[];
  /** Missense, nonsense, frameshift, and in-frame-indel variants across all reads. */
  criticalVariants: ClassifiedVariant[];
  hasUnsequencedCDS: boolean;
}

// ── Internal raw variant type ─────────────────────────────────────────────────

interface RawVariant {
  type: VariantType;
  refPos: number;
  queryPos: number;
  length: number;
  refBases: string;
  altBases: string;
  qualityScore?: number;
}

// ── Private helpers ───────────────────────────────────────────────────────────

const RC_MAP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", N: "N" };

function rc(seq: string): string {
  let out = "";
  for (let i = seq.length - 1; i >= 0; i--) {
    out += RC_MAP[seq[i]!.toUpperCase()] ?? "N";
  }
  return out;
}

/** Whether refPos lies within the annotation span (handles origin-spanning features). */
function isInFeature(refPos: number, ann: AnnotationSummary, circular: boolean): boolean {
  const spansOrigin = circular && ann.start >= ann.end;
  if (spansOrigin) return refPos >= ann.start || refPos < ann.end;
  return refPos >= ann.start && refPos < ann.end;
}

function findAnnotation(
  refPos: number,
  annotations: AnnotationSummary[],
  circular: boolean,
): AnnotationSummary | undefined {
  return annotations.find((ann) => isInFeature(refPos, ann, circular));
}

/**
 * Walk the SW aligned strings and extract all variants — substitutions AND
 * grouped indels — into raw events. Consecutive gap characters are grouped
 * into a single indel event so the length can be checked for frameshift (% 3).
 */
function extractRawVariants(
  refAligned: string,
  queryAligned: string,
  refStart: number,
  queryStart: number,
  qualityByRefPos: Map<number, number>,
): RawVariant[] {
  const variants: RawVariant[] = [];
  let refPos = refStart;
  let queryPos = queryStart;
  let i = 0;
  const len = refAligned.length;

  while (i < len) {
    const r = (refAligned[i] ?? "").toUpperCase();
    const q = (queryAligned[i] ?? "").toUpperCase();

    if (r === "-") {
      // Insertion in query — group consecutive gaps in the reference
      const startRefPos = refPos;
      const startQueryPos = queryPos;
      let altBases = "";
      while (i < len && (refAligned[i] ?? "") === "-") {
        altBases += (queryAligned[i] ?? "").toUpperCase();
        queryPos++;
        i++;
      }
      variants.push({
        type: "insertion",
        refPos: startRefPos,
        queryPos: startQueryPos,
        length: altBases.length,
        refBases: "-".repeat(altBases.length),
        altBases,
        // Quality for insertions: use the score at the position right before the gap
        qualityScore: qualityByRefPos.get(startRefPos - 1),
      });
    } else if (q === "-") {
      // Deletion in query — group consecutive gaps in the query
      const startRefPos = refPos;
      const startQueryPos = queryPos;
      let refBases = "";
      while (i < len && (queryAligned[i] ?? "") === "-") {
        refBases += (refAligned[i] ?? "").toUpperCase();
        refPos++;
        i++;
      }
      variants.push({
        type: "deletion",
        refPos: startRefPos,
        queryPos: startQueryPos,
        length: refBases.length,
        refBases,
        altBases: "-".repeat(refBases.length),
        qualityScore: undefined, // no quality for deleted bases
      });
    } else {
      // Aligned position
      if (r !== q && q !== "N") {
        variants.push({
          type: "substitution",
          refPos,
          queryPos,
          length: 1,
          refBases: r,
          altBases: q,
          qualityScore: qualityByRefPos.get(refPos),
        });
      }
      refPos++;
      queryPos++;
      i++;
    }
  }

  return variants;
}

/**
 * For a substitution in a forward-strand CDS, extract the codon before and
 * after the change and determine the amino acid effect.
 *
 * Handles origin-spanning CDS on circular plasmids via modular arithmetic.
 */
function classifySubInForwardCDS(
  refPos: number,
  altBase: string,
  cds: AnnotationSummary,
  seq: string,
  seqLen: number,
  circular: boolean,
): {
  codonIndex: number;
  posInCodon: number;
  refCodon: string;
  altCodon: string;
  refAA: string;
  altAA: string;
  effect: "silent" | "missense" | "nonsense";
} {
  const spansOrigin = circular && cds.start >= cds.end;
  const posInCDS = spansOrigin
    ? refPos >= cds.start
      ? refPos - cds.start
      : seqLen - cds.start + refPos
    : refPos - cds.start;

  const codonIndex = Math.floor(posInCDS / 3);
  const posInCodon = (posInCDS % 3) + 1; // 1-based

  // Codon bases at genome positions (start + codonIndex*3) + 0, 1, 2 (modular for circular)
  const codonBases = [0, 1, 2].map((offset) => {
    const absPos = (cds.start + codonIndex * 3 + offset) % seqLen;
    return seq[absPos]?.toUpperCase() ?? "N";
  });

  const refCodon = codonBases.join("");
  const altCodonBases = [...codonBases];
  altCodonBases[posInCodon - 1] = altBase.toUpperCase();
  const altCodon = altCodonBases.join("");

  // translate() with readThrough=true returns "*" for stop codons
  const refAA = translate(refCodon, true) || "?";
  const altAA = translate(altCodon, true) || "?";
  const effect = refAA === altAA ? "silent" : altAA === "*" ? "nonsense" : "missense";

  return { codonIndex, posInCodon, refCodon, altCodon, refAA, altAA, effect };
}

/**
 * For a substitution in a reverse-strand CDS, compute the codon change.
 *
 * Origin-spanning reverse-strand CDS (rare) returns null — caller falls back
 * to "inFeature" classification.
 */
function classifySubInReverseCDS(
  refPos: number,
  altBase: string,
  cds: AnnotationSummary,
  seq: string,
): {
  codonIndex: number;
  posInCodon: number;
  refCodon: string;
  altCodon: string;
  refAA: string;
  altAA: string;
  effect: "silent" | "missense" | "nonsense";
} | null {
  const spansOrigin = cds.start >= cds.end;
  if (spansOrigin) return null; // not supported in v1

  // mRNA reading position from the 5' end of the reverse-strand CDS
  const posInCDS = cds.end - 1 - refPos;
  if (posInCDS < 0) return null;

  const codonIndex = Math.floor(posInCDS / 3);
  const posInCodon = (posInCDS % 3) + 1; // 1-based in mRNA direction

  // Genomic slice of this codon: positions [end - 3*(codonIndex+1), end - codonIndex*3)
  const codonGenomicStart = cds.end - 3 - codonIndex * 3;
  if (codonGenomicStart < 0 || codonGenomicStart + 2 >= seq.length) return null;

  const genomicBases = [
    seq[codonGenomicStart]?.toUpperCase() ?? "N",
    seq[codonGenomicStart + 1]?.toUpperCase() ?? "N",
    seq[codonGenomicStart + 2]?.toUpperCase() ?? "N",
  ];

  const refCodon = rc(genomicBases.join(""));

  // The position within the genomic slice that corresponds to refPos
  const posInGenomicSlice = refPos - codonGenomicStart;
  const altGenomicBases = [...genomicBases];
  altGenomicBases[posInGenomicSlice] = altBase.toUpperCase();
  const altCodon = rc(altGenomicBases.join(""));

  const refAA = translate(refCodon, true) || "?";
  const altAA = translate(altCodon, true) || "?";
  const effect = refAA === altAA ? "silent" : altAA === "*" ? "nonsense" : "missense";

  return { codonIndex, posInCodon, refCodon, altCodon, refAA, altAA, effect };
}

/** Return the 0-based codon index of refPos within the CDS (handles both strands). */
function getCDSCodonIndex(
  cds: AnnotationSummary,
  refPos: number,
  seqLen: number,
  circular: boolean,
): number {
  const spansOrigin = circular && cds.start >= cds.end;
  if (cds.direction === 1) {
    const posInCDS = spansOrigin
      ? refPos >= cds.start
        ? refPos - cds.start
        : seqLen - cds.start + refPos
      : refPos - cds.start;
    return Math.floor(posInCDS / 3);
  } else {
    const posInCDS = spansOrigin
      ? refPos <= cds.end - 1
        ? cds.end - 1 - refPos
        : seqLen - refPos + cds.end - 1
      : cds.end - 1 - refPos;
    return Math.floor(Math.max(0, posInCDS) / 3);
  }
}

function classifyVariant(
  raw: RawVariant,
  annotations: AnnotationSummary[],
  seq: string,
  seqLen: number,
  circular: boolean,
): ClassifiedVariant {
  const isLikelySequencingError =
    raw.qualityScore !== undefined && raw.qualityScore < LOW_QUALITY_THRESHOLD;

  const ann = findAnnotation(raw.refPos, annotations, circular);

  let effect: VariantEffect;

  if (!ann) {
    effect = { kind: "intergenic" };
  } else if (ann.type !== "CDS") {
    effect = { kind: "inFeature", featureName: ann.name, featureType: ann.type };
  } else {
    // CDS annotation
    if (raw.type !== "substitution") {
      // Indel: check frameshift (length not divisible by 3 = reading frame disrupted)
      const isFrameshift = raw.length % 3 !== 0;
      const codonIndex = getCDSCodonIndex(ann, raw.refPos, seqLen, circular);
      effect = {
        kind: "inCDS",
        featureName: ann.name,
        codonIndex,
        posInCodon: 1,
        refCodon: raw.type === "deletion" ? raw.refBases.slice(0, 3).padEnd(3, "?") : "---",
        altCodon: raw.type === "insertion" ? raw.altBases.slice(0, 3).padEnd(3, "?") : "---",
        refAA: "",
        altAA: "",
        effect: isFrameshift ? "frameshift" : "in-frame-indel",
      };
    } else {
      // Substitution: classify amino acid change
      try {
        const info =
          ann.direction === 1
            ? classifySubInForwardCDS(raw.refPos, raw.altBases, ann, seq, seqLen, circular)
            : classifySubInReverseCDS(raw.refPos, raw.altBases, ann, seq);

        if (info) {
          effect = { kind: "inCDS", featureName: ann.name, ...info };
        } else {
          // Fallback for unsupported cases (origin-spanning reverse CDS)
          effect = { kind: "inFeature", featureName: ann.name, featureType: ann.type };
        }
      } catch {
        effect = { kind: "inFeature", featureName: ann.name, featureType: ann.type };
      }
    }
  }

  return {
    refPos: raw.refPos,
    queryPos: raw.queryPos,
    variantType: raw.type,
    length: raw.length,
    refBases: raw.refBases,
    altBases: raw.altBases,
    qualityScore: raw.qualityScore,
    isLikelySequencingError,
    effect,
  };
}

function unionIntervalLength(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0;
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0) return 0;

  let total = 0;
  let [curStart, curEnd] = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i]!;
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}

/**
 * Compute what fraction of each annotation is covered by aligned reads.
 * Handles origin-spanning features and origin-spanning read alignments on
 * circular plasmids. Uses interval union to avoid double-counting multi-read
 * coverage.
 */
function computeFeatureCoverage(
  annotations: AnnotationSummary[],
  reads: ReadInput[],
  seqLen: number,
  topology: "circular" | "linear",
): FeatureCoverage[] {
  const circular = topology === "circular";

  // Normalize read coverage into [start, end) intervals on the linear reference.
  // Origin-spanning read alignments (refEnd < refStart) are split into two.
  const readIntervals: [number, number][] = [];
  for (const read of reads) {
    const r = read.result;
    if (!r || r.score === 0) continue;
    if (r.refEnd > r.refStart) {
      readIntervals.push([r.refStart, r.refEnd]);
    } else if (circular) {
      readIntervals.push([r.refStart, seqLen]);
      if (r.refEnd > 0) readIntervals.push([0, r.refEnd]);
    }
  }

  return annotations.map((ann) => {
    const spansOrigin = circular && ann.start >= ann.end;
    const featureLen = spansOrigin ? seqLen - ann.start + ann.end : ann.end - ann.start;

    if (featureLen <= 0) {
      return { ...ann, coveredFraction: 0, fullySequenced: false };
    }

    // Map read intervals to feature-local coordinates [0, featureLen)
    const localIntervals: [number, number][] = [];

    for (const [rStart, rEnd] of readIntervals) {
      if (spansOrigin) {
        // Feature occupies [ann.start, seqLen) ++ [0, ann.end)
        // Part A: overlap with [ann.start, seqLen)
        const a0 = Math.max(rStart, ann.start);
        const a1 = Math.min(rEnd, seqLen);
        if (a1 > a0) localIntervals.push([a0 - ann.start, a1 - ann.start]);

        // Part B: overlap with [0, ann.end)
        const b0 = Math.max(rStart, 0);
        const b1 = Math.min(rEnd, ann.end);
        if (b1 > b0) localIntervals.push([seqLen - ann.start + b0, seqLen - ann.start + b1]);
      } else {
        const s = Math.max(rStart, ann.start);
        const e = Math.min(rEnd, ann.end);
        if (e > s) localIntervals.push([s - ann.start, e - ann.start]);
      }
    }

    const covered = Math.min(unionIntervalLength(localIntervals), featureLen);
    const coveredFraction = covered / featureLen;

    return {
      ...ann,
      coveredFraction,
      fullySequenced: coveredFraction >= FULL_COVERAGE_THRESHOLD,
    };
  });
}

function computeVerdict(
  reads: ReadVerification[],
  coverage: FeatureCoverage[],
): { verdict: Verdict; verdictReason: string } {
  const alignedReads = reads.filter((r) => r.aligned);
  const cdsFeatures = coverage.filter((f) => f.type === "CDS");
  const hasAnyCDS = cdsFeatures.length > 0;

  // FAILED: all reads unaligned
  if (reads.length > 0 && alignedReads.length === 0) {
    return {
      verdict: "FAILED",
      verdictReason: `${reads.length} read${reads.length > 1 ? "s" : ""} failed to align — the reads may be from a different plasmid or the wrong template was used.`,
    };
  }

  // FAILED: frameshift in any CDS (not suppressed by low quality)
  const frameshiftVars = alignedReads.flatMap((r) =>
    r.variants.filter(
      (v) =>
        !v.isLikelySequencingError &&
        v.effect.kind === "inCDS" &&
        v.effect.effect === "frameshift",
    ),
  );
  if (frameshiftVars.length > 0) {
    const fv = frameshiftVars[0]!;
    const name = fv.effect.kind === "inCDS" ? fv.effect.featureName : "CDS";
    const desc =
      fv.variantType === "insertion"
        ? `${fv.length}-bp insertion`
        : `${fv.length}-bp deletion`;
    return {
      verdict: "FAILED",
      verdictReason: `Frameshift in ${name} at position ${fv.refPos + 1}: ${desc} disrupts the reading frame.`,
    };
  }

  // FAILED: premature stop codon in any CDS
  const nonsenseVars = alignedReads.flatMap((r) =>
    r.variants.filter(
      (v) =>
        !v.isLikelySequencingError &&
        v.effect.kind === "inCDS" &&
        v.effect.effect === "nonsense",
    ),
  );
  if (nonsenseVars.length > 0) {
    const nv = nonsenseVars[0]!;
    const eff = nv.effect;
    const name = eff.kind === "inCDS" ? eff.featureName : "CDS";
    const codon = eff.kind === "inCDS" ? ` at codon ${eff.codonIndex + 1}` : "";
    return {
      verdict: "FAILED",
      verdictReason: `Premature stop codon in ${name}${codon} (${nv.refBases}→${nv.altBases}) — translation will terminate early.`,
    };
  }

  // MUTATION_DETECTED: missense or in-frame indel in any CDS
  const missenseVars = alignedReads.flatMap((r) =>
    r.variants.filter(
      (v) =>
        !v.isLikelySequencingError &&
        v.effect.kind === "inCDS" &&
        (v.effect.effect === "missense" || v.effect.effect === "in-frame-indel"),
    ),
  );
  if (missenseVars.length > 0) {
    const mv = missenseVars[0]!;
    const eff = mv.effect;
    const name = eff.kind === "inCDS" ? eff.featureName : "CDS";
    const detail =
      eff.kind === "inCDS" && eff.effect === "missense"
        ? ` — ${eff.refAA}→${eff.altAA} at codon ${eff.codonIndex + 1}`
        : eff.kind === "inCDS" && eff.effect === "in-frame-indel"
          ? ` — in-frame indel at codon ${eff.codonIndex + 1}`
          : "";
    return {
      verdict: "MUTATION_DETECTED",
      verdictReason: `Missense mutation in ${name} at position ${mv.refPos + 1}${detail}.`,
    };
  }

  // Check per-read identity
  const minIdentityRequired = hasAnyCDS ? CONFIRMED_MIN_IDENTITY : CONFIRMED_NO_CDS_IDENTITY;
  const poorReads = alignedReads.filter((r) => r.identity < minIdentityRequired);
  if (poorReads.length > 0) {
    const pr = poorReads[0]!;
    return {
      verdict: "INCOMPLETE",
      verdictReason: `Read "${pr.readName}" identity ${(pr.identity * 100).toFixed(1)}% is below the ${(minIdentityRequired * 100).toFixed(0)}% threshold — may contain additional unclassified variants.`,
    };
  }

  // Check CDS coverage
  if (hasAnyCDS) {
    const uncovered = cdsFeatures.filter((f) => !f.fullySequenced);
    if (uncovered.length > 0) {
      const names = uncovered
        .slice(0, 2)
        .map((f) => f.name)
        .join(", ");
      const tail = uncovered.length > 2 ? ` (+${uncovered.length - 2} more)` : "";
      return {
        verdict: "INCOMPLETE",
        verdictReason: `CDS not fully sequenced: ${names}${tail}. Submit additional reads to confirm clone integrity.`,
      };
    }
  }

  // All checks pass
  return {
    verdict: "CONFIRMED",
    verdictReason: hasAnyCDS
      ? `All reads ≥${(CONFIRMED_MIN_IDENTITY * 100).toFixed(0)}% identity, all CDS regions fully sequenced, no coding mutations detected.`
      : `All reads ≥${(CONFIRMED_NO_CDS_IDENTITY * 100).toFixed(0)}% identity, no mutations detected. Add CDS annotations for complete reading-frame verification.`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Verify a single sequencing read against an annotated plasmid. */
export function verifyRead(
  name: string,
  result: AlignmentResult | undefined,
  annotations: AnnotationSummary[],
  seq: string,
  topology: "circular" | "linear",
): ReadVerification {
  const seqLen = seq.length;
  const circular = topology === "circular";

  if (!result || result.score === 0) {
    return {
      readName: name,
      aligned: false,
      strand: "+",
      refStart: 0,
      refEnd: 0,
      identity: 0,
      coverage: 0,
      variants: [],
      silentCount: 0,
      missenseCount: 0,
      nonsenseCount: 0,
      frameshiftCount: 0,
      likelyErrorCount: 0,
    };
  }

  // Quality lookup by reference position — only substitutions have quality scores,
  // and only when the read aligned to the forward strand (align.ts strips rev-strand quality).
  const qualityByRefPos = new Map<number, number>();
  for (const m of result.mismatches) {
    if (m.qualityScore !== undefined) {
      qualityByRefPos.set(m.refPos, m.qualityScore);
    }
  }

  const rawVariants = extractRawVariants(
    result.refAligned,
    result.queryAligned,
    result.refStart,
    result.queryStart,
    qualityByRefPos,
  );

  const variants = rawVariants.map((rv) =>
    classifyVariant(rv, annotations, seq, seqLen, circular),
  );

  let silentCount = 0;
  let missenseCount = 0;
  let nonsenseCount = 0;
  let frameshiftCount = 0;
  let likelyErrorCount = 0;

  for (const v of variants) {
    if (v.isLikelySequencingError) {
      likelyErrorCount++;
      continue;
    }
    if (v.effect.kind === "inCDS") {
      switch (v.effect.effect) {
        case "silent":
          silentCount++;
          break;
        case "missense":
          missenseCount++;
          break;
        case "nonsense":
          nonsenseCount++;
          break;
        case "frameshift":
          frameshiftCount++;
          break;
      }
    }
  }

  return {
    readName: name,
    aligned: true,
    strand: result.strand,
    refStart: result.refStart,
    refEnd: result.refEnd,
    identity: result.identity,
    coverage: result.coverage,
    variants,
    silentCount,
    missenseCount,
    nonsenseCount,
    frameshiftCount,
    likelyErrorCount,
  };
}

/**
 * Full clone verification: classify all reads, compute feature coverage, and
 * emit a deterministic verdict.
 */
export function verifyClone(
  seq: string,
  topology: "circular" | "linear",
  name: string,
  annotations: AnnotationSummary[],
  reads: ReadInput[],
): VerificationResult {
  const verifiedReads = reads.map((r) =>
    verifyRead(r.name, r.result, annotations, seq, topology),
  );

  const coverage = computeFeatureCoverage(annotations, reads, seq.length, topology);

  const { verdict, verdictReason } = computeVerdict(verifiedReads, coverage);

  const CRITICAL_EFFECTS = new Set(["missense", "nonsense", "frameshift", "in-frame-indel"]);
  const criticalVariants = verifiedReads.flatMap((r) =>
    r.variants.filter(
      (v) =>
        !v.isLikelySequencingError &&
        v.effect.kind === "inCDS" &&
        CRITICAL_EFFECTS.has(v.effect.effect),
    ),
  );

  const hasCDS = annotations.some((a) => a.type === "CDS");
  const hasUnsequencedCDS = hasCDS && coverage.some((f) => f.type === "CDS" && !f.fullySequenced);

  return {
    verdict,
    verdictReason,
    reads: verifiedReads,
    featureCoverage: coverage,
    criticalVariants,
    hasUnsequencedCDS,
  };
}

/**
 * Serialize a VerificationResult into a structured text context for Claude.
 * Claude reads this to write a plain-English explanation — it does not recompute
 * the verdict.
 */
export function buildVerificationPromptContext(
  result: VerificationResult,
  name: string,
  seqLen: number,
  topology: "circular" | "linear",
  annotations: AnnotationSummary[],
): string {
  const lines: string[] = [];

  lines.push("== PLASMID ==");
  lines.push(`Name: ${name} (${seqLen.toLocaleString()} bp, ${topology})`);

  if (annotations.length > 0) {
    lines.push("\nAnnotated features:");
    for (const ann of annotations) {
      const strand = ann.direction === 1 ? "+" : "-";
      lines.push(`  • ${ann.name} [${ann.type}] ${ann.start + 1}–${ann.end} bp, ${strand} strand`);
    }
  }

  lines.push("\n== VERDICT (determined by deterministic code) ==");
  lines.push(`${result.verdict}: ${result.verdictReason}`);

  lines.push("\n== SEQUENCING READS ==");
  for (const read of result.reads) {
    if (!read.aligned) {
      lines.push(`\n${read.readName}: FAILED TO ALIGN — no match found in this sequence`);
      continue;
    }

    lines.push(
      `\n${read.readName}: ${read.strand} strand, ref ${read.refStart + 1}–${read.refEnd}, ${(read.identity * 100).toFixed(1)}% identity`,
    );

    const significant = read.variants.filter((v) => !v.isLikelySequencingError);
    const errors = read.variants.filter((v) => v.isLikelySequencingError);

    if (significant.length === 0) {
      lines.push("  No significant variants detected.");
    } else {
      for (const v of significant) {
        const pos = `pos ${v.refPos + 1}`;
        const change =
          v.variantType === "substitution"
            ? `${v.refBases}→${v.altBases}${v.qualityScore !== undefined ? ` (Q${v.qualityScore})` : " (Q unknown)"}`
            : v.variantType === "deletion"
              ? `${v.length}-bp deletion`
              : `${v.length}-bp insertion`;

        let effectStr: string;
        const eff = v.effect;
        if (eff.kind === "intergenic") {
          effectStr = "intergenic region";
        } else if (eff.kind === "inFeature") {
          effectStr = `in ${eff.featureName} [${eff.featureType}]`;
        } else {
          switch (eff.effect) {
            case "silent":
              effectStr = `SILENT in ${eff.featureName} codon ${eff.codonIndex + 1} (${eff.refCodon}→${eff.altCodon}, ${eff.refAA}→${eff.altAA})`;
              break;
            case "missense":
              effectStr = `MISSENSE in ${eff.featureName} codon ${eff.codonIndex + 1}: ${eff.refAA}→${eff.altAA} (${eff.refCodon}→${eff.altCodon})`;
              break;
            case "nonsense":
              effectStr = `PREMATURE STOP in ${eff.featureName} codon ${eff.codonIndex + 1}: ${eff.refAA}→* (${eff.refCodon}→${eff.altCodon})`;
              break;
            case "frameshift":
              effectStr = `FRAMESHIFT in ${eff.featureName} — disrupts reading frame from codon ${eff.codonIndex + 1}`;
              break;
            case "in-frame-indel":
              effectStr = `IN-FRAME INDEL in ${eff.featureName} at codon ${eff.codonIndex + 1}`;
              break;
            default:
              effectStr = `in ${eff.featureName}`;
          }
        }

        lines.push(`  • ${pos}: ${change} — ${effectStr}`);
      }
    }

    if (errors.length > 0) {
      lines.push(
        `  ${errors.length} low-quality call${errors.length !== 1 ? "s" : ""} (Q<${LOW_QUALITY_THRESHOLD}) omitted — likely sequencing artifacts.`,
      );
    }
  }

  lines.push("\n== FEATURE COVERAGE ==");
  for (const fc of result.featureCoverage) {
    const status = fc.fullySequenced
      ? "fully sequenced"
      : fc.coveredFraction > 0
        ? `${(fc.coveredFraction * 100).toFixed(0)}% covered — not fully sequenced`
        : "not sequenced by any read";
    lines.push(`  ${fc.name} [${fc.type}]: ${status}`);
  }

  return lines.join("\n");
}
