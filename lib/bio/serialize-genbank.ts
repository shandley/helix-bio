/**
 * Serialize a plasmid sequence and its annotations to GenBank flat-file format.
 *
 * Used for "Download annotated" — produces a .gb file that includes both the
 * original GenBank annotations and any features detected or edited in Ori.
 *
 * Wrapping (origin-spanning) annotations are emitted as join() locations so
 * downstream tools (SnapGene, Benchling, Geneious) parse them correctly.
 */

import type { BioAnnotation } from "./parse-genbank";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SerializeOptions {
	name: string;
	seq: string;
	topology: "circular" | "linear";
	description: string;
	/** Original GenBank annotations (overrides already applied). */
	annotations: BioAnnotation[];
	/** Auto-detected annotations — will carry /note="auto-annotated by Ori". */
	autoAnnotations?: BioAnnotation[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function padLeft(s: string, n: number): string {
	return s.padStart(n);
}

function wrapQualifier(key: string, value: string, indent = "                     "): string {
	const raw = `/${key}="${value}"`;
	// GenBank qualifiers wrap at 79 chars on continuation lines
	if (indent.length + raw.length <= 79) return indent + raw;
	const lines: string[] = [];
	let remaining = raw;
	while (remaining.length > 79 - indent.length) {
		lines.push(indent + remaining.slice(0, 79 - indent.length));
		remaining = remaining.slice(79 - indent.length);
	}
	if (remaining) lines.push(indent + remaining);
	return lines.join("\n");
}

function formatLocation(ann: BioAnnotation, seqLen: number): string {
	const start = ann.start + 1; // 1-indexed inclusive
	const end = ann.end; // 1-indexed inclusive (GenBank end is inclusive)
	const isComplement = ann.direction === -1;
	const isWrapping = ann.start > ann.end; // start > end → spans origin

	let loc: string;
	if (isWrapping) {
		// Origin-spanning: emit as join(start..seqLen, 1..end)
		loc = `join(${start}..${seqLen},1..${end})`;
	} else {
		loc = `${start}..${end}`;
	}

	return isComplement ? `complement(${loc})` : loc;
}

function formatFeature(ann: BioAnnotation, seqLen: number, isAuto: boolean): string {
	const loc = formatLocation(ann, seqLen);
	const type = ann.type || "misc_feature";
	// Feature type padded to 16 chars, then location
	const typeStr = type.padEnd(16);
	const lines = [`     ${typeStr}${loc}`];

	const indent = "                     "; // 21 spaces (standard GenBank)

	lines.push(wrapQualifier("label", ann.name, indent));

	if (ann.color) {
		lines.push(wrapQualifier("color", ann.color, indent));
	}

	if (isAuto) {
		lines.push(wrapQualifier("note", "auto-annotated by Ori", indent));
	}

	return lines.join("\n");
}

function formatSequence(seq: string): string {
	const lines: string[] = [];
	const lower = seq.toLowerCase();
	for (let i = 0; i < lower.length; i += 60) {
		const pos = padLeft(String(i + 1), 9);
		const chunk = lower.slice(i, i + 60);
		// Split into groups of 10
		const groups = chunk.match(/.{1,10}/g) ?? [];
		lines.push(`${pos} ${groups.join(" ")}`);
	}
	return lines.join("\n");
}

function todayStr(): string {
	const d = new Date();
	const months = [
		"JAN",
		"FEB",
		"MAR",
		"APR",
		"MAY",
		"JUN",
		"JUL",
		"AUG",
		"SEP",
		"OCT",
		"NOV",
		"DEC",
	];
	return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

// ── Main serializer ───────────────────────────────────────────────────────────

export function serializeGenBank(opts: SerializeOptions): string {
	const { name, seq, topology, description, annotations, autoAnnotations = [] } = opts;
	const seqLen = seq.length;

	// LOCUS line: name (truncated to 16), length, DNA, topology, date
	const locusName = name.replace(/\s+/g, "_").slice(0, 16).padEnd(16);
	const topoStr = topology === "circular" ? "circular" : "linear  ";
	const locus = `LOCUS       ${locusName} ${String(seqLen).padStart(9)} bp    DNA     ${topoStr} ${todayStr()}`;

	const lines: string[] = [
		locus,
		`DEFINITION  ${description || name}.`,
		"ACCESSION   .",
		"VERSION     .",
		"FEATURES             Location/Qualifiers",
	];

	// Source feature (required by spec)
	lines.push(`     source          1..${seqLen}`);
	lines.push(`                     /mol_type="other DNA"`);

	// Original GenBank annotations
	for (const ann of annotations) {
		lines.push(formatFeature(ann, seqLen, false));
	}

	// Auto-annotations (marked)
	for (const ann of autoAnnotations) {
		lines.push(formatFeature(ann, seqLen, true));
	}

	lines.push("ORIGIN");
	lines.push(formatSequence(seq));
	lines.push("//");

	return lines.join("\n") + "\n";
}

/**
 * Trigger a browser download of the serialized GenBank content.
 */
export function downloadGenBank(content: string, filename: string): void {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename.endsWith(".gb") ? filename : `${filename}.gb`;
	a.click();
	URL.revokeObjectURL(url);
}
