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

/**
 * Deterministic validation. Supports two modes:
 *   Mode A: insert provided, parts list includes "INSERT"
 *   Mode C: no insert, parts list includes a catalog CDS (e.g. "egfp_cds")
 */
export function validateDesign(
  design: ConstructDesign,
  insert?: InsertInfo,
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

  const hasInsert = design.parts.some((p) => p.partId === "INSERT");
  const hasCatalogCDS = design.parts.some((p) => PARTS_BY_ID[p.partId]?.type === "cds");

  // Must have either INSERT or a catalog CDS
  if (!hasInsert && !hasCatalogCDS) {
    warnings.push({
      severity: "error",
      message: "No coding sequence in this design. Provide a gene sequence or describe a specific gene (e.g. GFP, Cas9) so Ori can select it.",
    });
  }

  // INSERT specified but no sequence provided
  if (hasInsert && (!insert?.seq || insert.seq.trim().length === 0)) {
    warnings.push({
      severity: "error",
      message: "Paste a gene sequence above, or leave the insert blank and describe a specific gene so Ori selects it from its library.",
    });
  }

  // Multiple INSERTs
  if (design.parts.filter((p) => p.partId === "INSERT").length > 1) {
    warnings.push({ severity: "warning", message: "Design places INSERT more than once." });
  }

  // Must have at least one origin of replication
  if (!design.parts.some((p) => PARTS_BY_ID[p.partId]?.type === "ori")) {
    warnings.push({ severity: "error", message: "No origin of replication — this plasmid cannot replicate in bacteria." });
  }

  // Must have at least one resistance marker
  if (!design.parts.some((p) => PARTS_BY_ID[p.partId]?.type === "marker")) {
    warnings.push({ severity: "error", message: "No selection marker — bacteria cannot be selected after transformation." });
  }

  // Validate user-provided insert sequence
  if (hasInsert && insert?.seq) {
    const insertSeq = insert.seq.toUpperCase().replace(/\s/g, "");
    if (insertSeq.length > 0 && !insertSeq.startsWith("ATG")) {
      warnings.push({ severity: "warning", message: "Insert does not start with ATG — ensure it includes the start codon." });
    }
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
  }

  // Promoter/RBS should be on the same strand as the coding sequence
  const cdsEntry =
    design.parts.find((p) => p.partId === "INSERT") ??
    design.parts.find((p) => PARTS_BY_ID[p.partId]?.type === "cds");
  if (cdsEntry) {
    const cdsDir = cdsEntry.direction;
    for (const { partId, direction } of design.parts) {
      const part = PARTS_BY_ID[partId];
      if (!part) continue;
      if ((part.type === "promoter" || part.type === "rbs") && direction !== cdsDir) {
        warnings.push({
          severity: "warning",
          message: `${part.name} is on the opposite strand from the coding sequence — check orientation.`,
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
  cds: "#1d4ed8",
  insert: "#1d4ed8",
};

/**
 * Assemble parts + optional insert into a circular construct.
 * Mode A: insert provided, INSERT sentinel in parts list.
 * Mode C: no insert, catalog CDS part in parts list.
 */
export function assembleConstruct(
  design: ConstructDesign,
  insert?: InsertInfo,
): AssembledConstruct {
  const warnings = validateDesign(design, insert);
  const cleanInsertSeq = insert?.seq.toUpperCase().replace(/\s/g, "") ?? "";

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
      partName = insert?.name ?? "Insert";
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
