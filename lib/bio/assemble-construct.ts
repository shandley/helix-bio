/**
 * Construct assembly and validation.
 *
 * Pure functions — no I/O, no Claude calls.
 * Takes a ConstructDesign (from Claude) + user insert → ParsedSequence.
 */

import type { Annotation } from "./annotate";
import { PARTS_BY_ID } from "./parts-catalog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConstructDesign {
  constructName: string;
  organism: "ecoli" | "mammalian" | "yeast";
  /** Ordered parts list. Use partId "INSERT" to place the user's sequence. */
  parts: { partId: string; direction: 1 | -1 }[];
  explanation: string;
  warnings: string[];
}

export interface InsertInfo {
  name: string;
  seq: string;
}

export interface AssemblyWarning {
  severity: "error" | "warning";
  message: string;
}

export interface AssembledConstruct {
  name: string;
  seq: string;
  topology: "circular";
  annotations: Annotation[];
  warnings: AssemblyWarning[];
}

// ── Validation ────────────────────────────────────────────────────────────────

const RC_MAP: Record<string, string> = { A: "T", T: "A", G: "C", C: "G", N: "N" };
function rc(seq: string): string {
  let out = "";
  for (let i = seq.length - 1; i >= 0; i--) out += RC_MAP[seq[i]!.toUpperCase()] ?? "N";
  return out;
}

/** Deterministic validation: check the design for known failure modes. */
export function validateDesign(
  design: ConstructDesign,
  insert: InsertInfo,
): AssemblyWarning[] {
  const warnings: AssemblyWarning[] = [];

  // All referenced parts must exist in catalog (except INSERT)
  for (const { partId } of design.parts) {
    if (partId !== "INSERT" && !PARTS_BY_ID[partId]) {
      warnings.push({
        severity: "error",
        message: `Unknown part "${partId}" — not found in the parts catalog.`,
      });
    }
  }

  // Must include INSERT exactly once
  const insertCount = design.parts.filter((p) => p.partId === "INSERT").length;
  if (insertCount === 0) {
    warnings.push({ severity: "error", message: "Design has no INSERT — your sequence was not placed in the construct." });
  }
  if (insertCount > 1) {
    warnings.push({ severity: "warning", message: "Design places INSERT more than once." });
  }

  // Must have at least one origin of replication
  const hasOri = design.parts.some((p) => PARTS_BY_ID[p.partId]?.type === "ori");
  if (!hasOri) {
    warnings.push({ severity: "error", message: "No origin of replication selected — this plasmid cannot replicate in bacteria." });
  }

  // Must have at least one resistance marker
  const hasMarker = design.parts.some((p) => PARTS_BY_ID[p.partId]?.type === "marker");
  if (!hasMarker) {
    warnings.push({ severity: "error", message: "No selection marker — bacteria transformed with this plasmid cannot be selected." });
  }

  // Insert should start with ATG
  const insertSeq = insert.seq.toUpperCase().replace(/\s/g, "");
  if (insertSeq.length > 0 && !insertSeq.startsWith("ATG")) {
    warnings.push({ severity: "warning", message: `Insert does not start with ATG — ensure it includes the start codon.` });
  }

  // Insert should contain a stop codon in-frame
  const hasStop =
    insertSeq.length >= 6 &&
    ["TAA", "TAG", "TGA"].some((stop) => {
      for (let i = 0; i + 3 <= insertSeq.length; i += 3) {
        if (insertSeq.slice(i, i + 3) === stop) return true;
      }
      return false;
    });
  if (insertSeq.length > 0 && !hasStop) {
    warnings.push({ severity: "warning", message: "No in-frame stop codon found in insert — confirm the sequence is complete." });
  }

  // Promoter and RBS should be on the same strand as INSERT
  const insertEntry = design.parts.find((p) => p.partId === "INSERT");
  if (insertEntry) {
    const insertDir = insertEntry.direction;
    for (const { partId, direction } of design.parts) {
      const part = PARTS_BY_ID[partId];
      if (!part) continue;
      if ((part.type === "promoter" || part.type === "rbs") && direction !== insertDir) {
        warnings.push({
          severity: "warning",
          message: `${part.name} is on the opposite strand from the INSERT — check orientation.`,
        });
      }
    }
  }

  return warnings;
}

// ── Assembly ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  promoter: "#16a34a",
  rbs: "#0891b2",
  terminator: "#dc2626",
  ori: "#d97706",
  marker: "#7c3aed",
  insert: "#1d4ed8",
};

/**
 * Assemble parts + insert into a circular ParsedSequence.
 * Each part is included with its annotation; reverse-strand parts are RC'd.
 */
export function assembleConstruct(
  design: ConstructDesign,
  insert: InsertInfo,
): AssembledConstruct {
  const warnings = validateDesign(design, insert);
  const cleanInsertSeq = insert.seq.toUpperCase().replace(/\s/g, "");

  let seq = "";
  const annotations: Annotation[] = [];

  for (let i = 0; i < design.parts.length; i++) {
    const { partId, direction } = design.parts[i]!;

    let partSeq: string;
    let partName: string;
    let partType: string;
    let partColor: string;

    if (partId === "INSERT") {
      partSeq = direction === -1 ? rc(cleanInsertSeq) : cleanInsertSeq;
      partName = insert.name;
      partType = "CDS";
      partColor = TYPE_COLORS["insert"]!;
    } else {
      const part = PARTS_BY_ID[partId];
      if (!part) continue;
      partSeq = direction === -1 ? rc(part.seq) : part.seq;
      partName = part.name;
      partType = part.type;
      partColor = TYPE_COLORS[part.type] ?? "#9a9284";
    }

    const start = seq.length;
    seq += partSeq;
    const end = seq.length;

    annotations.push({
      id: `${partId}-${i}`,
      name: partName,
      type: partType,
      start,
      end,
      direction,
      identity: 1,
      color: partColor,
    });
  }

  return {
    name: design.constructName,
    seq,
    topology: "circular",
    annotations,
    warnings,
  };
}
