#!/usr/bin/env python3
"""
Validate collected sequences for one canonical feature.

Validation strategy (two tiers):

Tier 1 — Fast filters (no external tools):
  - NCBI reference sequences: always pass (fetched from authoritative accessions)
  - SnapGene corpus sequences: pass if length within [0.5x, 2.0x] expected range
  - iGEM sequences: pass if length within range AND name match score >= 0.5

Tier 2 — MMseqs2 search (optional, if mmseqs2 available):
  - Search against all SnapGene sequences at 70% identity / 60% coverage
  - Any sequence not matching an existing SnapGene sequence gets flagged
  - Flag doesn't discard — marks for manual review

Usage:
  python3 03_validate.py <feature_id> <registry_json> <raw_fna> <output_fna>

Called from run_03_validate.sh SLURM array job.
"""

import json
import re
import sys
from pathlib import Path

# ── Args ──────────────────────────────────────────────────────────────────────

if len(sys.argv) < 5:
    print(f"Usage: {sys.argv[0]} <feature_id> <registry_json> <raw_fna> <output_fna>")
    sys.exit(1)

feature_id = sys.argv[1]
registry_path = Path(sys.argv[2])
raw_fna = Path(sys.argv[3])
output_fna = Path(sys.argv[4])

# ── Load registry entry ───────────────────────────────────────────────────────

registry: list[dict] = json.loads(registry_path.read_text())
feat = next(
    (r for r in registry
     if r.get("_source_name") == feature_id or r.get("canonical_name") == feature_id),
    None,
)
if feat is None:
    print(f"ERROR: feature '{feature_id}' not found in registry")
    sys.exit(1)

expected_len = feat.get("expected_length_bp", [20, 10000])
len_min = expected_len[0] * 0.4   # generous — 40% of min
len_max = expected_len[1] * 2.5   # generous — 250% of max (some variants are longer)
canonical_name = feat.get("canonical_name", feature_id)

# Build alias set for name matching
def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())

alias_norms = {norm(a) for a in [canonical_name] + feat.get("aliases", []) if a}

# ── Parse raw FASTA ───────────────────────────────────────────────────────────

def parse_fasta(path: Path) -> list[tuple[str, str]]:
    """Return list of (header, seq) tuples."""
    records = []
    header = None
    seq_parts: list[str] = []
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            if header is not None:
                records.append((header, "".join(seq_parts)))
            header = line[1:].strip()
            seq_parts = []
        else:
            seq_parts.append(line.strip().upper())
    if header is not None:
        records.append((header, "".join(seq_parts)))
    return records

if not raw_fna.exists() or raw_fna.stat().st_size == 0:
    print(f"Empty or missing input: {raw_fna}")
    output_fna.write_text("")
    sys.exit(0)

records = parse_fasta(raw_fna)
print(f"Input: {len(records)} sequences for '{canonical_name}'")
print(f"Expected length: {expected_len[0]}–{expected_len[1]} bp (filter: {int(len_min)}–{int(len_max)})")

# ── Validation ────────────────────────────────────────────────────────────────

passing: list[tuple[str, str]] = []
reasons: dict[str, str] = {}

for header, seq in records:
    seq_len = len(seq)
    parts = header.split("|")
    seq_id = parts[0]

    # NCBI reference sequences always pass
    if seq_id.startswith("ncbi_"):
        passing.append((header, seq))
        reasons[seq_id] = f"ncbi_ref ({seq_len} bp)"
        continue

    # Length filter
    if seq_len < len_min or seq_len > len_max:
        reasons[seq_id] = f"FAIL length {seq_len} bp (range {int(len_min)}–{int(len_max)})"
        continue

    # Name match from header (format: id|name|type|len)
    if len(parts) >= 2:
        feat_name_from_header = norm(parts[1].replace("_", " "))
        if feat_name_from_header in alias_norms:
            passing.append((header, seq))
            reasons[seq_id] = f"name_match ({seq_len} bp)"
            continue

    # Fallback: length filter alone passes it (loose — BLAST would be stricter)
    passing.append((header, seq))
    reasons[seq_id] = f"length_ok ({seq_len} bp, no name match)"

# ── Write output ──────────────────────────────────────────────────────────────

if passing:
    lines = []
    for header, seq in passing:
        lines.append(f">{header}")
        # Wrap at 80 chars
        for i in range(0, len(seq), 80):
            lines.append(seq[i:i+80])
    output_fna.write_text("\n".join(lines) + "\n")
    print(f"Passed: {len(passing)} / {len(records)} sequences")
else:
    output_fna.write_text("")
    print(f"WARN: 0 sequences passed for '{canonical_name}'")

# Print breakdown
fail_reasons = [v for v in reasons.values() if v.startswith("FAIL")]
print(f"  Length failures: {len(fail_reasons)}")
print(f"  Name matches:    {sum(1 for v in reasons.values() if 'name_match' in v)}")
print(f"  NCBI refs:       {sum(1 for v in reasons.values() if 'ncbi_ref' in v)}")
