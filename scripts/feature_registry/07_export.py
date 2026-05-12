#!/usr/bin/env python3
"""
Export canonical feature sequences for use in Ori's browser annotation engine.

Reads:
  feature_registry/canonical_features.json  (200 canonical features + metadata)
  feature_registry/variants/                 (clustered representative sequences)

Writes:
  feature_registry/canonical_features_export.fna
    FASTA with header format: >canonical_name|SO_type|length
    One entry per representative sequence, tagged with canonical names.
    This file replaces lib/bio/canonical_features.fna in the Ori repo.

  feature_registry/export_stats.json
    Summary: sequences per feature, coverage, etc.

After running:
  1. scp canonical_features_export.fna to Ori repo as lib/bio/canonical_features.fna
  2. node scripts/build-feature-db.mjs  (regenerates public/data/features.json)
  3. git add + commit + push

Usage (on HTCF):
  python3 07_export.py
"""

import json
import re
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
DB       = Path("/scratch/sahlab/shandley/helix-feature-db/feature_registry")
VARIANTS = DB / "variants"
REGISTRY = DB / "canonical_features.json"
OUT_FNA  = DB / "canonical_features_export.fna"
OUT_STATS = DB / "export_stats.json"

# ── Load registry ─────────────────────────────────────────────────────────────
registry: list[dict] = json.loads(REGISTRY.read_text())
print(f"Registry: {len(registry)} canonical features")

# SO type → feature type mapping (for features.json type field)
SO_TYPE_MAP = {
    "resistance_marker": "CDS",
    "origin_of_replication": "rep_origin",
    "promoter_bacterial": "promoter",
    "promoter_mammalian": "promoter",
    "promoter_yeast": "promoter",
    "promoter_plant": "promoter",
    "promoter_insect": "promoter",
    "promoter_inducible": "promoter",
    "promoter_viral": "promoter",
    "promoter_pol3": "promoter",
    "terminator": "terminator",
    "terminator_yeast": "terminator",
    "terminator_plant": "terminator",
    "polya_signal": "polyA_signal",
    "reporter": "CDS",
    "epitope_tag": "CDS",
    "purification_tag": "CDS",
    "recombination_site": "protein_bind",
    "crispr_element": "misc_RNA",
    "crispr_nuclease": "CDS",
    "crispr_nickase": "CDS",
    "crispr_rna_targeting": "CDS",
    "regulatory": "regulatory",
    "viral_element": "LTR",
    "enhancer": "enhancer",
    "selection_marker": "CDS",
    "negative_selection": "CDS",
    "nuclear_localization": "CDS",
    "self_cleaving_peptide": "CDS",
    "protease_site": "CDS",
    "ires": "misc_feature",
    "insulator": "misc_feature",
    "structural": "misc_feature",
    "proximity_labeling": "CDS",
    "transposase": "CDS",
    "recombinase": "CDS",
    "centromere": "misc_feature",
    "cloning_site": "misc_feature",
    "viral_replication": "CDS",
}

MAX_SEQS_PER_FEATURE = 30  # cap per feature to keep features.json browser-sized

def safe_id(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", s)

def read_fasta(path: Path) -> list[tuple[str, str]]:
    records, hdr, parts = [], None, []
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            if hdr is not None:
                records.append((hdr, "".join(parts)))
            hdr, parts = line[1:].strip(), []
        else:
            parts.append(line.strip().upper())
    if hdr is not None:
        records.append((hdr, "".join(parts)))
    return records

# ── Build export FASTA ─────────────────────────────────────────────────────────
print(f"\nBuilding export FASTA (max {MAX_SEQS_PER_FEATURE} seqs per feature)...")

stats: list[dict] = []
total_seqs = 0
missing = 0
seen_variant_files: set[str] = set()  # prevent writing same file twice

import random
random.seed(42)

with open(OUT_FNA, "w") as out:
    for feat in registry:
        source_name  = feat.get("_source_name", feat.get("canonical_name", ""))
        canon_name   = feat.get("canonical_name", source_name)
        category     = feat.get("category", feat.get("_category_hint", "misc_feature"))
        feat_type    = SO_TYPE_MAP.get(category, "misc_feature")

        sid = safe_id(source_name)
        variant_path = VARIANTS / f"{sid}.fna"

        # Skip duplicate variant files (two registry entries → same safe_id)
        if str(variant_path) in seen_variant_files:
            stats.append({"name": canon_name, "seqs": 0, "status": "duplicate"})
            continue

        if not variant_path.exists() or variant_path.stat().st_size == 0:
            missing += 1
            stats.append({"name": canon_name, "seqs": 0, "status": "no_variants"})
            continue

        seen_variant_files.add(str(variant_path))
        records = read_fasta(variant_path)
        if not records:
            missing += 1
            stats.append({"name": canon_name, "seqs": 0, "status": "empty"})
            continue

        # Cap sequences per feature
        if len(records) > MAX_SEQS_PER_FEATURE:
            records = random.sample(records, MAX_SEQS_PER_FEATURE)

        # Sanitize canonical name for FASTA header
        safe_name = canon_name.replace(" ", "_").replace("/", "-").replace("|", "-")

        written = 0
        for _orig_hdr, seq in records:
            if not seq:
                continue
            header = f">{safe_name}|{feat_type}|{len(seq)}"
            out.write(f"{header}\n")
            for i in range(0, len(seq), 80):
                out.write(seq[i:i+80] + "\n")
            written += 1
            total_seqs += 1

        stats.append({"name": canon_name, "seqs": written, "status": "ok"})

# ── Write stats ────────────────────────────────────────────────────────────────
OUT_STATS.write_text(json.dumps({
    "total_features": len(registry),
    "features_with_sequences": len(registry) - missing,
    "features_missing": missing,
    "total_sequences": total_seqs,
    "per_feature": stats,
}, indent=2))

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"Features with sequences: {len(registry) - missing} / {len(registry)}")
print(f"Total representative sequences: {total_seqs}")
print(f"Output: {OUT_FNA}")
print(f"Size: {OUT_FNA.stat().st_size / 1024:.0f} KB")

print("\nTop 10 by sequence count:")
for s in sorted(stats, key=lambda x: -x["seqs"])[:10]:
    print(f"  {s['name']:40s} {s['seqs']} seqs")

missing_list = [s["name"] for s in stats if s["status"] != "ok"]
if missing_list:
    print(f"\nMissing variants ({len(missing_list)}):")
    for name in missing_list[:10]:
        print(f"  {name}")
    if len(missing_list) > 10:
        print(f"  ... and {len(missing_list)-10} more")

print(f"\nDone. Next:")
print(f"  scp {OUT_FNA} user@local:/path/to/ori/lib/bio/canonical_features.fna")
print(f"  node scripts/build-feature-db.mjs")
